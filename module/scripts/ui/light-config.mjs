/**
 * Champ « Hauteur de la lumière », pour les ombres portées (canvas/cast-shadows.mjs).
 *
 * - Lumière d'ambiance : AmbientLightConfig (client/applications/sheets/ambient-light-config.mjs,
 *   ApplicationV2), onglet « basic » (templates/scene/parts/light-basic.hbs) — inséré après `elevation`,
 *   stocké dans `flags.dnd5e-lumiere.height` de la lumière.
 * - Lumière d'un token : onglet « light » (templates/scene/token/light.hbs) commun à TokenConfig et à
 *   PrototypeTokenConfig (client/applications/sheets/token/mixin.mjs:42) — inséré après le rayon, stocké
 *   dans `flags.dnd5e-lumiere.lightHeight` du token (`lightHeight` et pas `height`, pour ne pas laisser
 *   croire à la hauteur du token lui-même). Le formulaire du prototype enveloppe les champs dans
 *   `prototypeToken`, le flag suit donc sur les tokens posés ensuite.
 *
 * Le `name` du champ suffit pour que le formulaire du cœur l'enregistre ; vide, il enregistre `null` et le
 * réglage du monde s'applique.
 */

import { MODULE_ID, setting } from "../settings.mjs";

export const LIGHT_FLAG = "height";
export const TOKEN_LIGHT_FLAG = "lightHeight";

export function registerLightConfig() {
  Hooks.on("renderAmbientLightConfig", (app, element) => {
    const doc = app.document;
    inject(element, { flag: LIGHT_FLAG, value: doc.getFlag(MODULE_ID, LIGHT_FLAG), after: '[name="elevation"]' });
  });
  const onToken = (app, element) => {
    const token = app.token ?? app.document;
    const value = foundry.utils.getProperty(token, `flags.${MODULE_ID}.${TOKEN_LIGHT_FLAG}`);
    inject(element, { flag: TOKEN_LIGHT_FLAG, value, after: '[name="light.dim"]' });
  };
  Hooks.on("renderTokenConfig", onToken);
  Hooks.on("renderPrototypeTokenConfig", onToken);
}

function inject(element, { flag, value, after }) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const name = `flags.${MODULE_ID}.${flag}`;
  if ( !root || root.querySelector(`[name="${name}"]`) ) return;
  const anchor = root.querySelector(after)?.closest(".form-group");
  if ( !anchor ) return;

  const units = canvas.scene?.grid.units ?? game.system.grid?.units ?? "";
  const group = document.createElement("div");
  group.className = "form-group slim";
  group.innerHTML = `
    <label>${game.i18n.localize("DND5E_LUMIERE.LightConfig.Height")}
      <span class="units">(${units})</span></label>
    <div class="form-fields">
      <input type="number" name="${name}" min="0" step="1">
    </div>
    <p class="hint">${game.i18n.format("DND5E_LUMIERE.LightConfig.HeightHint",
    { default: setting("lightHeight") })}</p>`;
  const input = group.querySelector("input");
  input.placeholder = String(setting("lightHeight"));
  if ( Number.isFinite(value) ) input.value = String(value);
  anchor.after(group);
}
