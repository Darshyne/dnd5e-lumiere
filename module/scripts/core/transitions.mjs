/**
 * Transitions de scène : description des effets, lecture d'un fichier de configuration importé, et choix de la
 * transition à jouer quand la vue change (scène globale, changement de niveau). Calcul pur, testé.
 *
 * Une transition DAS = un **effet de base** (le shader, écrit dans le module) + des **paramètres**. Un fichier JSON
 * importé ne contient donc que des paramètres : jamais de code, ni JavaScript ni GLSL.
 */

/** Préfixe des clés dans `CONFIG.Canvas.sceneTransitions` : jamais en collision avec le cœur ni un autre module. */
export const TRANSITION_PREFIX = "das-";

/** Format accepté à l'import, écrit à l'export. */
export const FILE_FORMAT = "das-transitions";
export const FILE_VERSION = 1;

/**
 * Effets de base et leurs paramètres : valeur par défaut, bornes (nombres) ou choix (chaînes), couleurs `#rrggbb`.
 * Les valeurs par défaut de l'encre viennent de la démo navigateur du module Transition Encre (Call of Cthulhu).
 */
export const BASES = Object.freeze({
  ink: {
    duration: 4500,
    params: {
      hold: { default: 12, min: 0, max: 60 },          // % de la durée passé sur le noir complet
      drops: { default: 5, min: 1, max: 6, integer: true },
      stagger: { default: 0.45, min: 0, max: 1 },
      warp: { default: 1.18, min: 0, max: 3 },
      lobeScale: { default: 3.5, min: 0.5, max: 10 },
      lobeAmt: { default: 0.93, min: 0, max: 2 },
      tendrils: { default: 0.82, min: 0, max: 2 },
      density: { default: 1, min: 0, max: 1.5 },
      rim: { default: 0.65, min: 0, max: 1 },
      rimWidth: { default: 0.093, min: 0.005, max: 0.5 },
      soft: { default: 0.022, min: 0.001, max: 0.2 },
      grain: { default: 0, min: 0, max: 1 },
      ink: { default: "#0b0b10", color: true },
      reveal: { default: "holes", choices: ["holes", "wash"] },
      holes: { default: 4, min: 1, max: 6, integer: true }
    }
  },
  depth: {
    duration: 1100,
    params: {
      direction: { default: "up", choices: ["up", "down"] }, // up : on s'élève, le plan quitté s'éloigne
      zoom: { default: 0.35, min: 0.05, max: 1 },             // écart d'échelle de chaque plan
      blur: { default: 0.6, min: 0, max: 1 },                  // flou de profondeur du plan qui s'éloigne
      dim: { default: 0.45, min: 0, max: 1 },                  // assombrissement du plan qui s'éloigne
      ghost: { default: 0.55, min: 0, max: 1 }                 // part de la durée où les deux plans se superposent
    }
  }
});

/**
 * Transitions livrées avec le module (clé sans préfixe → définition).
 * `depth` sert au changement de niveau (alpha) : elle n'est inscrite que quand cette option est active.
 */
export const BUILT_IN = Object.freeze({
  ink: { base: "ink", label: "DND5E_LUMIERE.Transitions.Presets.ink" },
  inkWash: { base: "ink", label: "DND5E_LUMIERE.Transitions.Presets.inkWash", params: { reveal: "wash" } },
  inkBlood: { base: "ink", label: "DND5E_LUMIERE.Transitions.Presets.inkBlood",
    params: { ink: "#3a0000", reveal: "wash", grain: 0.4 } },
  depth: { base: "depth", label: "DND5E_LUMIERE.Transitions.Presets.depth" }
});

/** @param {string} id  Clé sans préfixe. */
export function transitionKey(id) {
  return `${TRANSITION_PREFIX}${id}`;
}

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Paramètres complets d'un effet de base : défauts, puis valeurs fournies, bornées.
 * @param {string} base
 * @param {object} [given]
 * @param {string[]} [warnings]  Reçoit les clés inconnues ou les valeurs refusées.
 */
export function resolveParams(base, given = {}, warnings = []) {
  const schema = BASES[base]?.params ?? {};
  const out = {};
  for ( const [key, spec] of Object.entries(schema) ) out[key] = spec.default;
  for ( const [key, value] of Object.entries(given ?? {}) ) {
    const spec = schema[key];
    if ( !spec ) { warnings.push(`unknown param "${key}"`); continue; }
    if ( spec.choices ) {
      if ( spec.choices.includes(value) ) out[key] = value;
      else warnings.push(`"${key}" must be one of ${spec.choices.join(", ")}`);
    }
    else if ( spec.color ) {
      if ( (typeof value === "string") && COLOR_PATTERN.test(value) ) out[key] = value.toLowerCase();
      else warnings.push(`"${key}" must be a #rrggbb colour`);
    }
    else {
      const n = Number(value);
      if ( (value === null) || (value === "") || !Number.isFinite(n) ) { warnings.push(`"${key}" must be a number`); continue; }
      let v = Math.min(spec.max, Math.max(spec.min, n));
      if ( spec.integer ) v = Math.round(v);
      if ( v !== n ) warnings.push(`"${key}" clamped to ${v}`);
      out[key] = v;
    }
  }
  return out;
}

/**
 * Libellé d'une transition importée : une chaîne, ou une table par langue (`{ "en": "…", "fr": "…" }`).
 * @param {string|Record<string,string>} label
 * @param {string} lang
 */
export function pickLabel(label, lang = "en") {
  if ( typeof label === "string" ) return label;
  if ( !label || (typeof label !== "object") ) return "";
  return label[lang] ?? label[lang?.split("-")[0]] ?? label.en ?? Object.values(label).find(v => typeof v === "string") ?? "";
}

/**
 * Lit le contenu d'un fichier de configuration (déjà passé par `JSON.parse`).
 * Accepte `{ format, version, transitions: [...] }`, un tableau, ou une seule transition.
 * @param {*} data
 * @returns {{ transitions: object[], errors: string[], warnings: string[] }}
 *   `transitions` : entrées valides, normalisées `{ id, label, base, duration, params }`.
 */
export function parseTransitionFile(data) {
  const errors = [];
  const warnings = [];
  let list;
  if ( Array.isArray(data) ) list = data;
  else if ( data && (typeof data === "object") && Array.isArray(data.transitions) ) {
    if ( (data.format !== undefined) && (data.format !== FILE_FORMAT) ) errors.push(`unknown format "${data.format}"`);
    if ( Number(data.version) > FILE_VERSION ) warnings.push(`file version ${data.version} is newer than ${FILE_VERSION}`);
    list = data.transitions;
  }
  else if ( data && (typeof data === "object") && ("base" in data) ) list = [data];
  else {
    errors.push("no transitions found");
    return { transitions: [], errors, warnings };
  }
  if ( errors.length ) return { transitions: [], errors, warnings };

  const transitions = [];
  const seen = new Set();
  list.forEach((entry, i) => {
    const where = `#${i + 1}${entry?.id ? ` (${entry.id})` : ""}`;
    if ( !entry || (typeof entry !== "object") ) { errors.push(`${where}: not an object`); return; }
    if ( (typeof entry.id !== "string") || !ID_PATTERN.test(entry.id) ) {
      errors.push(`${where}: "id" must start with a letter, then letters, digits, - or _ (40 max)`);
      return;
    }
    if ( entry.id in BUILT_IN ) { errors.push(`${where}: "${entry.id}" is a built-in transition`); return; }
    if ( seen.has(entry.id) ) { errors.push(`${where}: duplicate id`); return; }
    if ( !(entry.base in BASES) ) {
      errors.push(`${where}: "base" must be one of ${Object.keys(BASES).join(", ")}`);
      return;
    }
    const label = (typeof entry.label === "string") ? entry.label.trim()
      : (entry.label && (typeof entry.label === "object")) ? Object.fromEntries(Object.entries(entry.label)
        .filter(([, v]) => (typeof v === "string") && v.trim()).map(([k, v]) => [k, v.trim()])) : "";
    if ( !pickLabel(label) ) { errors.push(`${where}: "label" is required`); return; }
    const local = [];
    const params = resolveParams(entry.base, entry.params, local);
    for ( const w of local ) warnings.push(`${where}: ${w}`);
    let duration = BASES[entry.base].duration;
    if ( entry.duration !== undefined ) {
      const d = Number(entry.duration);
      if ( Number.isFinite(d) ) duration = Math.round(Math.min(10000, Math.max(500, d)) / 100) * 100;
      else warnings.push(`${where}: "duration" must be a number of milliseconds`);
    }
    seen.add(entry.id);
    transitions.push({ id: entry.id, label, base: entry.base, duration, params });
  });
  return { transitions, errors, warnings };
}

/**
 * Fichier d'export : uniquement les paramètres qui s'écartent des défauts, pour un fichier lisible.
 * @param {object[]} transitions  Entrées normalisées.
 */
export function exportTransitionFile(transitions) {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    transitions: transitions.map(t => {
      const schema = BASES[t.base]?.params ?? {};
      const params = Object.fromEntries(Object.entries(t.params ?? {})
        .filter(([k, v]) => schema[k] && (schema[k].default !== v)));
      return { id: t.id, label: t.label, base: t.base, duration: t.duration, params };
    })
  };
}

/**
 * Fusionne des transitions importées dans la liste du monde : même id = remplacée.
 * @returns {{ list: object[], added: number, replaced: number }}
 */
export function mergeTransitions(current, incoming) {
  const list = [...(current ?? [])];
  let added = 0;
  let replaced = 0;
  for ( const t of incoming ) {
    const i = list.findIndex(c => c.id === t.id);
    if ( i >= 0 ) { list[i] = t; replaced++; }
    else { list.push(t); added++; }
  }
  return { list, added, replaced };
}

/**
 * Transition à imposer quand la vue change, ou `null` pour laisser faire le cœur.
 *
 * - Changement de **scène** : la transition globale du monde, si la scène n'en a pas (ou si elle doit les remplacer).
 * - Changement de **niveau** dans la même scène : la transition de profondeur, montante ou descendante.
 * Une transition déjà demandée par l'appelant (`canvas.transition.run`, `scene.view({ transition })`) est respectée.
 *
 * @param {object} view
 * @param {boolean} view.explicit           L'appelant a déjà fourni une transition.
 * @param {boolean} view.sceneChanged
 * @param {boolean} view.levelChanged       Même scène, autre niveau.
 * @param {string|null} view.sceneType      `scene.transition.type` de la scène affichée.
 * @param {{type: string, duration: number, activeOnly: boolean, override: boolean}|null} view.global
 * @param {{enabled: boolean, type: string, duration: number}|null} view.level
 * @param {number|null} view.fromBottom     Bas du niveau quitté (`elevation.bottom`, null = −∞).
 * @param {number|null} view.toBottom       Bas du niveau rejoint.
 * @returns {{type: string, duration: number, activeOnly?: boolean, direction?: string}|null}
 */
export function chooseTransition({ explicit, sceneChanged, levelChanged, sceneType, global, level, fromBottom, toBottom }) {
  if ( explicit ) return null;
  if ( sceneChanged ) {
    if ( !global?.type ) return null;
    if ( sceneType && !global.override ) return null;
    return { type: global.type, duration: global.duration, activeOnly: !!global.activeOnly };
  }
  if ( levelChanged && level?.enabled && level.type ) {
    const from = fromBottom ?? -Infinity;
    const to = toBottom ?? -Infinity;
    if ( from === to ) return null;
    return { type: level.type, duration: level.duration, direction: to > from ? "up" : "down" };
  }
  return null;
}
