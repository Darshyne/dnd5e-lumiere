/**
 * Réglages. Par client : chaque effet se coupe sur la machine qui le trouve trop coûteux.
 * Par monde : l'aspect des ombres, le même pour toute la table.
 */

import { CAST_DEFAULTS } from "./core/cast-shadow.mjs";
import { CONTACT_DEFAULTS } from "./core/contact-shadow.mjs";
import { DARKVISION_DEFAULTS } from "./core/darkvision.mjs";
import { HOVER_DEFAULTS } from "./core/hover.mjs";
import { JUMP_DEFAULTS } from "./core/jump.mjs";
import { PERSPECTIVE_DEFAULTS } from "./core/perspective.mjs";
import { SUN_DEFAULTS } from "./core/sun.mjs";

export const MODULE_ID = "dnd5e-lumiere";

/**
 * Valeurs lues une fois puis gardées : `game.settings.get` coûte ~13 µs par lecture (mesuré le 2026-09-26
 * dans un monde de test), et le module en fait une douzaine par token à chaque rafraîchissement, jusqu'à
 * chaque image pendant un déplacement. Le cache est vidé par le `onChange` du réglage, qui se déclenche
 * aussi quand un autre client modifie un réglage de monde.
 * @type {Map<string, *>}
 */
const cache = new Map();

export function setting(key) {
  if ( !cache.has(key) ) cache.set(key, game.settings.get(MODULE_ID, key));
  return cache.get(key);
}

/** @param {string} key  @param {() => void} [refresh] */
function changed(key, refresh) {
  return () => {
    cache.delete(key);
    refresh?.();
  };
}

/** @param {() => void} refresh  Appelé quand un réglage visuel change. */
export function registerSettings(refresh) {
  const toggle = (key, { implemented }) => game.settings.register(MODULE_ID, key, {
    name: `DND5E_LUMIERE.Settings.${key}.Name`,
    hint: `DND5E_LUMIERE.Settings.${key}.Hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    // Tant qu'un effet n'est pas écrit, rien à rafraîchir : un rechargement suffira.
    requiresReload: !implemented,
    onChange: changed(key, implemented ? refresh : undefined)
  });
  toggle("contactShadow", { implemented: true });
  toggle("hover", { implemented: true });
  toggle("jump", { implemented: true });
  toggle("perspective", { implemented: true });
  toggle("lightShadows", { implemented: true });
  toggle("darkvisionBlur", { implemented: true });

  const range = (key, def, min, max, step) => game.settings.register(MODULE_ID, key, {
    name: `DND5E_LUMIERE.Settings.${key}.Name`,
    hint: `DND5E_LUMIERE.Settings.${key}.Hint`,
    scope: "world",
    config: true,
    type: new foundry.data.fields.NumberField({ min, max, step, initial: def }),
    default: def,
    onChange: changed(key, refresh)
  });
  range("contactSize", CONTACT_DEFAULTS.size, 0.5, 2, 0.05);
  range("contactOpacity", CONTACT_DEFAULTS.opacity, 0, 1, 0.05);
  range("hoverLift", HOVER_DEFAULTS.lift, 0, 0.5, 0.01);
  range("hoverAmplitude", HOVER_DEFAULTS.amplitude, 0, 0.15, 0.01);
  range("jumpHeight", JUMP_DEFAULTS.height, 0.1, 0.8, 0.05);
  range("elevationLift", PERSPECTIVE_DEFAULTS.maxLift, 0, 1.5, 0.05);
  range("perspectiveMax", PERSPECTIVE_DEFAULTS.maxScale, 0, 0.5, 0.05);
  range("fadeAlpha", PERSPECTIVE_DEFAULTS.fadeAlpha, 0.1, 1, 0.05);
  range("castIntensity", CAST_DEFAULTS.intensity, 0, 1, 0.05);
  range("lightHeight", CAST_DEFAULTS.lightHeight, 1, 30, 1);
  range("castMaxLength", CAST_DEFAULTS.maxLength, 0.5, 6, 0.5);
  range("castFlicker", CAST_DEFAULTS.flicker, 0, 2, 0.1);

  // Le soleil : décision de monde (une table en extérieur, une autre toujours sous terre), coupable par scène.
  game.settings.register(MODULE_ID, "sunShadows", {
    name: "DND5E_LUMIERE.Settings.sunShadows.Name",
    hint: "DND5E_LUMIERE.Settings.sunShadows.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: changed("sunShadows", refresh)
  });
  range("sunAltitude", SUN_DEFAULTS.maxAltitude, 15, 85, 5);
  range("darkvisionBlurStrength", DARKVISION_DEFAULTS.blur, 0, 8, 0.5);
}
