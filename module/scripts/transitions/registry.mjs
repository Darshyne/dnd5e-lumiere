/**
 * Inscription des transitions DAS dans `CONFIG.Canvas.sceneTransitions` (client/config.mjs:985). Le cœur y lit
 * tout : menus de la configuration de scène (scene-config.mjs:233) et du comportement Teleport Token
 * (teleport-token.mjs:38), lecture d'une transition au dessin du canvas (board.mjs:1294), `canvas.transition.run`.
 *
 * Toutes les clés commencent par `das-` : réinscrire = effacer ces clés puis tout reposer, sans toucher au cœur ni
 * aux autres modules. Les transitions importées vivent dans le réglage de monde `customTransitions`.
 */

import { BASES, BUILT_IN, TRANSITION_PREFIX, pickLabel, resolveParams, transitionKey } from "../core/transitions.mjs";
import { MODULE_ID } from "../settings.mjs";
import DepthTransitionFilter, { setNextDirection } from "./depth-filter.mjs";
import InkTransitionFilter from "./ink-filter.mjs";

const FILTERS = { ink: InkTransitionFilter, depth: DepthTransitionFilter };

/** Transitions importées dans ce monde (entrées normalisées par `parseTransitionFile`). */
export function customTransitions() {
  const list = game.settings.get(MODULE_ID, "customTransitions");
  return Array.isArray(list) ? list : [];
}

/** La transition de changement de niveau (alpha) est-elle active dans ce monde ? */
export function levelTransitionEnabled() {
  return game.settings.get(MODULE_ID, "levelTransition") === true;
}

/**
 * Toutes les transitions DAS de ce monde, pour la fenêtre de gestion.
 * @returns {{key: string, id: string, label: string, base: string, duration: number, params: object, builtIn: boolean}[]}
 */
export function dasTransitions() {
  const out = [];
  for ( const [id, def] of Object.entries(BUILT_IN) ) {
    if ( (def.base === "depth") && !levelTransitionEnabled() ) continue;
    out.push({ key: transitionKey(id), id, label: game.i18n.localize(def.label), base: def.base,
      duration: BASES[def.base].duration, params: resolveParams(def.base, def.params), builtIn: true });
  }
  for ( const t of customTransitions() ) {
    if ( !(t.base in FILTERS) ) continue;
    out.push({ key: transitionKey(t.id), id: t.id, label: pickLabel(t.label, game.i18n.lang) || t.id, base: t.base,
      duration: t.duration, params: resolveParams(t.base, t.params), builtIn: false });
  }
  return out;
}

/** (Ré)inscrit les transitions DAS. Appelé au `setup`, puis à chaque changement des réglages concernés. */
export function registerTransitions() {
  const table = CONFIG.Canvas.sceneTransitions;
  for ( const key of Object.keys(table) ) if ( key.startsWith(TRANSITION_PREFIX) ) delete table[key];
  for ( const t of dasTransitions() ) {
    table[t.key] = {
      id: t.key,
      label: `DAS · ${t.label}`,
      filterClass: FILTERS[t.base],
      filterType: t.key,
      defaultDuration: t.duration,
      params: t.params
    };
  }
}

/** Libellé affiché d'une transition quelconque (cœur, DAS ou autre module). */
export function transitionLabel(key) {
  const def = CONFIG.Canvas.sceneTransitions[key];
  if ( !def ) return key;
  return game.i18n.localize(def.label ?? `SCENE.Transition.Types.${key}`);
}

/**
 * Joue une transition sur la scène affichée, de son image actuelle vers elle-même : on voit l'effet complet,
 * contrairement à l'aperçu du cœur qui part du noir.
 * @param {string} key
 * @param {{duration?: number, direction?: "up"|"down"}} [options]
 */
export async function previewTransition(key, { duration, direction } = {}) {
  const def = CONFIG.Canvas.sceneTransitions[key];
  if ( !def || !canvas.ready ) return;
  if ( direction ) setNextDirection(direction);
  await canvas.transition.run({
    operation: async () => {},
    duration: duration ?? def.defaultDuration ?? canvas.transition.defaultDuration,
    transitionType: key
  });
}
