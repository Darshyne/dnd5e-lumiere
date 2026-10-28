/**
 * Réglage du son porté d'un token (étape 13) : un bloc « Son porté (DAS) » en bas de l'onglet « Apparence » de TokenConfig et de
 * PrototypeTokenConfig (client/applications/sheets/token/mixin.mjs:37-60, templates/scene/token/appearance.hbs), stocké dans
 * `flags.dnd5e-lumiere.sound` du token. Comme pour la hauteur de la lumière (ui/light-config.mjs), le `name` des champs suffit pour
 * que le formulaire du cœur l'enregistre, et celui du prototype suit sur les tokens posés ensuite.
 */

import { SOUND_DEFAULTS } from "../core/carried-sound.mjs";
import { SOUND_FLAG } from "../canvas/carried-sounds.mjs";
import { MODULE_ID } from "../settings.mjs";

const label = key => game.i18n.localize(`DND5E_LUMIERE.SoundConfig.${key}`);
const attr = value => foundry.utils.escapeHTML(String(value ?? ""));

export function registerSoundConfig() {
  const onToken = (app, element) => {
    const token = app.token ?? app.document;
    inject(element, foundry.utils.getProperty(token, `flags.${MODULE_ID}.${SOUND_FLAG}`) ?? {});
  };
  Hooks.on("renderTokenConfig", onToken);
  Hooks.on("renderPrototypeTokenConfig", onToken);
}

function inject(element, value) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const base = `flags.${MODULE_ID}.${SOUND_FLAG}`;
  if ( !root || root.querySelector(`[name="${base}.idle"]`) ) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]');
  if ( !tab ) return;

  const units = canvas.scene?.grid.units ?? game.system.grid?.units ?? "";
  const cells = SOUND_DEFAULTS.radiusCells * (canvas.scene?.grid.distance ?? game.system.grid?.distance ?? 5);
  const volume = Number.isFinite(Number(value.volume)) && (value.volume !== "") ? Number(value.volume) : SOUND_DEFAULTS.volume;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "dnd5e-lumiere-sound";
  fieldset.innerHTML = `
    <legend>${label("Legend")}</legend>
    <p class="hint">${label("Hint")}</p>
    <div class="form-group">
      <label>${label("Idle")}</label>
      <div class="form-fields"><file-picker name="${base}.idle" type="audio" value="${attr(value.idle)}"></file-picker></div>
    </div>
    <div class="form-group">
      <label>${label("Combat")}</label>
      <div class="form-fields"><file-picker name="${base}.combat" type="audio" value="${attr(value.combat)}"></file-picker></div>
      <p class="hint">${label("CombatHint")}</p>
    </div>
    <div class="form-group slim">
      <label>${label("Radius")} <span class="units">(${attr(units)})</span></label>
      <div class="form-fields"><input type="number" name="${base}.radius" min="0" step="0.5" placeholder="${cells}"
        value="${Number.isFinite(Number(value.radius)) && (value.radius !== "") && (value.radius !== null) ? attr(value.radius) : ""}"></div>
    </div>
    <div class="form-group">
      <label>${label("Volume")}</label>
      <div class="form-fields"><range-picker name="${base}.volume" min="0" max="1" step="0.05" value="${volume}"></range-picker></div>
    </div>
    <div class="form-group">
      <label>${label("Walls")}</label>
      <div class="form-fields"><input type="checkbox" name="${base}.walls" ${value.walls === true ? "checked" : ""}></div>
      <p class="hint">${label("WallsHint")}</p>
    </div>`;
  tab.append(fieldset);
}
