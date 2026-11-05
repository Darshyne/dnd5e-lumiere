/**
 * Orientation d'un token (issue #4) : un bloc « Orientation (DAS) » en bas de l'onglet « Apparence » de TokenConfig et de
 * PrototypeTokenConfig, stocké dans `flags.dnd5e-lumiere.facing` (`{ mode, art }`). Même procédé que le son porté
 * (ui/sound-config.mjs) : le `name` des champs suffit pour que le formulaire du cœur l'enregistre. C'est un réglage du MJ,
 * écrit une fois ; le sens du token pendant le jeu, lui, n'est jamais écrit.
 */

import { FACING_FLAG } from "../canvas/facing.mjs";
import { artOf } from "../core/facing.mjs";
import { MODULE_ID } from "../settings.mjs";

export function registerFacingConfig() {
  const onToken = (app, element) => {
    const token = app.token ?? app.document;
    inject(element, foundry.utils.getProperty(token, `flags.${MODULE_ID}.${FACING_FLAG}`) ?? {});
  };
  Hooks.on("renderTokenConfig", onToken);
  Hooks.on("renderPrototypeTokenConfig", onToken);
}

function inject(element, value) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const base = `flags.${MODULE_ID}.${FACING_FLAG}`;
  if ( !root || root.querySelector(`[name="${base}.mode"]`) ) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]');
  if ( !tab ) return;

  const t = key => game.i18n.localize(key);
  const option = (val, label, current) => `<option value="${val}" ${val === current ? "selected" : ""}>${t(label)}</option>`;
  const mode = ["always", "never"].includes(value.mode) ? value.mode : "setting";
  const art = artOf(value);
  const fieldset = document.createElement("fieldset");
  fieldset.className = "dnd5e-lumiere-facing";
  fieldset.innerHTML = `
    <legend>${t("DND5E_LUMIERE.FacingConfig.Legend")}</legend>
    <p class="hint">${t("DND5E_LUMIERE.FacingConfig.Hint")}</p>
    <div class="form-group">
      <label>${t("DND5E_LUMIERE.FacingConfig.Mode")}</label>
      <div class="form-fields"><select name="${base}.mode">
        ${option("setting", "DND5E_LUMIERE.FacingConfig.ModeSetting", mode)}
        ${option("always", "DND5E_LUMIERE.FacingConfig.ModeAlways", mode)}
        ${option("never", "DND5E_LUMIERE.FacingConfig.ModeNever", mode)}
      </select></div>
    </div>
    <div class="form-group">
      <label>${t("DND5E_LUMIERE.FacingConfig.Art")}</label>
      <div class="form-fields"><select name="${base}.art">
        ${option("right", "DND5E_LUMIERE.FacingConfig.ArtRight", art)}
        ${option("left", "DND5E_LUMIERE.FacingConfig.ArtLeft", art)}
      </select></div>
      <p class="hint">${t("DND5E_LUMIERE.FacingConfig.ArtHint")}</p>
    </div>`;
  tab.append(fieldset);
}
