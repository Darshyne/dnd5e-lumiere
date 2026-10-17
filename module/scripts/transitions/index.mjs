/**
 * Transitions de scène : réglages, inscription, transition globale et de changement de niveau, petite API.
 *
 * Réglages de monde (décision de table) :
 * - `customTransitions` : transitions importées d'un fichier JSON (fenêtre « Transitions ») ;
 * - `globalTransition`  : `{ type, duration, activeOnly, override }`, édité dans la même fenêtre ;
 * - `levelTransition` (alpha) et `levelTransitionDuration` : la profondeur au changement de niveau.
 */

import { BASES, parseTransitionFile, mergeTransitions, transitionKey } from "../core/transitions.mjs";
import { MODULE_ID } from "../settings.mjs";
import { TransitionsApp, refreshTransitionsApp } from "../ui/transitions-app.mjs";
import { customTransitions, dasTransitions, previewTransition, registerTransitions } from "./registry.mjs";
import { registerViewTransitions } from "./view.mjs";

/** Durée de Foundry pour une nouvelle scène (common/documents/scene.mjs:140). */
const CORE_INITIAL_DURATION = 1500;

function reregister() {
  registerTransitions();
  refreshTransitionsApp();
}

export function registerTransitionSettings() {
  game.settings.registerMenu(MODULE_ID, "transitionsMenu", {
    name: "DND5E_LUMIERE.Transitions.Menu.Name",
    label: "DND5E_LUMIERE.Transitions.Menu.Label",
    hint: "DND5E_LUMIERE.Transitions.Menu.Hint",
    icon: "fa-solid fa-film",
    type: TransitionsApp(),
    restricted: true
  });
  game.settings.register(MODULE_ID, "customTransitions", {
    scope: "world", config: false, type: Array, default: [], onChange: reregister
  });
  game.settings.register(MODULE_ID, "globalTransition", {
    scope: "world", config: false, type: Object,
    default: { type: "", duration: null, activeOnly: false, override: false },
    onChange: refreshTransitionsApp
  });
  game.settings.register(MODULE_ID, "levelTransition", {
    name: "DND5E_LUMIERE.Settings.levelTransition.Name",
    hint: "DND5E_LUMIERE.Settings.levelTransition.Hint",
    scope: "world", config: true, type: Boolean, default: false, onChange: reregister
  });
  game.settings.register(MODULE_ID, "levelTransitionDuration", {
    name: "DND5E_LUMIERE.Settings.levelTransitionDuration.Name",
    hint: "DND5E_LUMIERE.Settings.levelTransitionDuration.Hint",
    scope: "world", config: true,
    type: new foundry.data.fields.NumberField({ min: 400, max: 3000, step: 100, initial: BASES.depth.duration }),
    default: BASES.depth.duration
  });

  // Les réglages de monde sont lisibles au `setup` ; le canvas n'est dessiné qu'après.
  Hooks.once("setup", registerTransitions);
  registerViewTransitions();
  registerSceneConfigDuration();
}

/**
 * Une transition DAS choisie dans la configuration de scène alors que la durée est encore celle de Foundry (1500 ms) :
 * on propose sa propre durée (l'encre est réglée pour 4,5 s).
 */
function registerSceneConfigDuration() {
  Hooks.on("renderSceneConfig", (app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const typeInput = root?.querySelector('[name="transition.type"]');
    const durationInput = root?.querySelector('[name="transition.duration"]');
    if ( !typeInput || !durationInput || typeInput.dataset.dasBound ) return;
    typeInput.dataset.dasBound = "true";
    typeInput.addEventListener("change", () => {
      const def = CONFIG.Canvas.sceneTransitions[typeInput.value];
      if ( !typeInput.value.startsWith("das-") || !def?.defaultDuration ) return;
      if ( Number(durationInput.value) === CORE_INITIAL_DURATION ) durationInput.value = def.defaultDuration;
    });
  });
}

/** `game.modules.get("dnd5e-lumiere").api.transitions` : pour une macro ou les tests. */
export const transitionsApi = {
  /** Toutes les transitions DAS de ce monde. */
  list: () => dasTransitions(),
  /** Joue une transition sur la scène affichée (`id` sans préfixe, ou clé complète, ou clé du cœur). */
  preview: (id, options) => previewTransition(CONFIG.Canvas.sceneTransitions[id] ? id : transitionKey(id), options),
  /**
   * Importe le contenu d'un fichier de configuration (objet déjà lu). MJ seulement.
   * @returns {Promise<{added: number, replaced: number, errors: string[], warnings: string[]}>}
   */
  async import(data) {
    if ( !game.user.isGM ) throw new Error(`${MODULE_ID} | only a GM can import transitions`);
    const { transitions, errors, warnings } = parseTransitionFile(data);
    if ( !transitions.length ) return { added: 0, replaced: 0, errors, warnings };
    const { list, added, replaced } = mergeTransitions(customTransitions(), transitions);
    await game.settings.set(MODULE_ID, "customTransitions", list);
    return { added, replaced, errors, warnings };
  },
  /** Ouvre la fenêtre de gestion. */
  open: () => new (TransitionsApp())().render({ force: true })
};
