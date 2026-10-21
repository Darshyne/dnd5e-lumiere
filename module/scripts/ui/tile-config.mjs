/**
 * Case « Toit toujours visible », pour les toits des cartes en fausse perspective (canvas/roofs.mjs).
 *
 * TileConfig (client/applications/sheets/tile-config.mjs, ApplicationV2), onglet « overhead »
 * (templates/scene/tile/overhead.hbs) — insérée après « Restreindre la météo », stockée dans
 * `flags.dnd5e-lumiere.alwaysVisibleRoof` de la tuile. Le `name` suffit pour que le formulaire du cœur l'enregistre.
 */

import { ROOF_FLAG } from "../core/roofs.mjs";
import { MODULE_ID } from "../settings.mjs";

export function registerTileConfig() {
  Hooks.on("renderTileConfig", (app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const name = `flags.${MODULE_ID}.${ROOF_FLAG}`;
    if ( !root || root.querySelector(`[name="${name}"]`) ) return;
    const anchor = root.querySelector('[name="restrictions.weather"]')?.closest(".form-group");
    if ( !anchor ) return;
    const group = document.createElement("div");
    group.className = "form-group";
    group.innerHTML = `
      <label>${game.i18n.localize("DND5E_LUMIERE.TileConfig.Roof")}</label>
      <div class="form-fields"><input type="checkbox" name="${name}"></div>
      <p class="hint">${game.i18n.localize("DND5E_LUMIERE.TileConfig.RoofHint")}</p>`;
    group.querySelector("input").checked = app.document?.getFlag(MODULE_ID, ROOF_FLAG) === true;
    anchor.after(group);
  });
}
