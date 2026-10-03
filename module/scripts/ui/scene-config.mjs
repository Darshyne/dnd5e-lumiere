/**
 * Réglages du soleil propres à une scène, dans l'onglet « Environnement » de SceneConfig
 * (client/applications/sheets/scene-config.mjs:50, templates/scene/config/environment.hbs) : un groupe ajouté
 * en fin d'onglet.
 *
 * - `flags.dnd5e-lumiere.sun` (case) : le soleil projette-t-il des ombres ici ? Décochée pour un intérieur
 *   éclairé par une lumière globale. Absent = oui.
 * - `flags.dnd5e-lumiere.north` (degrés) : où est le nord sur la carte, dans le sens horaire depuis le haut.
 *
 * Comme pour la hauteur des lumières, le `name` des champs suffit au formulaire du cœur (une case décochée
 * enregistre `false`, un nombre vide `null`).
 */

import { MODULE_ID } from "../settings.mjs";
import { NORTH_FLAG, SUN_FLAG } from "../canvas/sun.mjs";

export function registerSceneConfig() {
  Hooks.on("renderSceneConfig", (app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const tab = root?.querySelector('.tab[data-tab="environment"]');
    if ( !tab || tab.querySelector(`[name="flags.${MODULE_ID}.${SUN_FLAG}"]`) ) return;
    const scene = app.document;
    const i18n = key => game.i18n.localize(`DND5E_LUMIERE.SceneConfig.${key}`);

    const fieldset = document.createElement("fieldset");
    fieldset.innerHTML = `
      <legend>${i18n("Legend")}</legend>
      <div class="form-group">
        <label>${i18n("Sun")}</label>
        <div class="form-fields"><input type="checkbox" name="flags.${MODULE_ID}.${SUN_FLAG}"></div>
        <p class="hint">${i18n("SunHint")}</p>
      </div>
      <div class="form-group slim">
        <label>${i18n("North")} <span class="units">(°)</span></label>
        <div class="form-fields">
          <input type="number" name="flags.${MODULE_ID}.${NORTH_FLAG}" min="0" max="359" step="1" placeholder="0">
        </div>
        <p class="hint">${i18n("NorthHint")}</p>
      </div>`;
    fieldset.querySelector('input[type="checkbox"]').checked = scene.getFlag(MODULE_ID, SUN_FLAG) !== false;
    const north = scene.getFlag(MODULE_ID, NORTH_FLAG);
    if ( Number.isFinite(north) ) fieldset.querySelector('input[type="number"]').value = String(north);
    tab.append(fieldset);
  });
}
