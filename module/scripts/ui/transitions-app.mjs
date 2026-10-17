/**
 * Fenêtre « Transitions » (menu des réglages du module, MJ seulement) :
 * - la **transition globale** du monde, jouée en entrant dans une scène qui n'en a pas (ou dans toutes) ;
 * - la liste des transitions DAS, chacune avec un aperçu et un export JSON ;
 * - l'**import** d'un fichier JSON de transitions (paramètres seulement, voir core/transitions.mjs), et la suppression
 *   des transitions importées.
 */

import { exportTransitionFile, parseTransitionFile, mergeTransitions } from "../core/transitions.mjs";
import { MODULE_ID } from "../settings.mjs";
import { customTransitions, dasTransitions, previewTransition, transitionLabel } from "../transitions/registry.mjs";
import { globalTransition } from "../transitions/view.mjs";

const loc = (key, data) => data ? game.i18n.format(key, data) : game.i18n.localize(key);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** La classe, créée au premier usage : `foundry.applications` n'existe pas encore au chargement du script. */
let AppClass = null;
export const TransitionsApp = () => AppClass ??= class TransitionsApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "dnd5e-lumiere-transitions",
    classes: ["dnd5e-lumiere-transitions"],
    window: { title: "DND5E_LUMIERE.Transitions.Title", icon: "fa-solid fa-film", resizable: true },
    position: { width: 680, height: 720 }
  };

  /** Un seul exemplaire : le menu des réglages crée la fenêtre par `new`. */
  constructor(options = {}) {
    const existing = foundry.applications.instances.get("dnd5e-lumiere-transitions");
    if ( existing ) return existing;
    super(options);
  }

  async _renderHTML() {
    const global = globalTransition() ?? {};
    const types = Object.keys(CONFIG.Canvas.sceneTransitions)
      .map(key => ({ key, label: transitionLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    const options = [`<option value="">${esc(loc("DND5E_LUMIERE.Transitions.None"))}</option>`]
      .concat(types.map(t => `<option value="${esc(t.key)}" ${t.key === global.type ? "selected" : ""}>${esc(t.label)}</option>`))
      .join("");
    const dur = global.type ? CONFIG.Canvas.sceneTransitions[global.type]?.defaultDuration : null;

    const rows = dasTransitions().map(t => `<tr data-key="${esc(t.key)}" data-id="${esc(t.id)}">
        <td>${esc(t.label)}</td>
        <td>${esc(loc(`DND5E_LUMIERE.Transitions.Base.${t.base}`))}</td>
        <td class="num">${(t.duration / 1000).toFixed(1)} s</td>
        <td>${esc(loc(t.builtIn ? "DND5E_LUMIERE.Transitions.BuiltIn" : "DND5E_LUMIERE.Transitions.Imported"))}</td>
        <td class="actions">
          <button type="button" data-action="preview" data-tooltip="DND5E_LUMIERE.Transitions.Preview"><i class="fa-solid fa-play"></i></button>
          <button type="button" data-action="exportOne" data-tooltip="DND5E_LUMIERE.Transitions.ExportOne"><i class="fa-solid fa-file-export"></i></button>
          ${t.builtIn ? "" : `<button type="button" data-action="remove" data-tooltip="DND5E_LUMIERE.Transitions.Remove"><i class="fa-solid fa-trash"></i></button>`}
        </td></tr>`).join("");

    const root = document.createElement("div");
    root.className = "dl-transitions standard-form";
    root.innerHTML = `
      <fieldset>
        <legend>${esc(loc("DND5E_LUMIERE.Transitions.Global"))}</legend>
        <p class="hint">${esc(loc("DND5E_LUMIERE.Transitions.GlobalHint"))}</p>
        <div class="form-group">
          <label>${esc(loc("DND5E_LUMIERE.Transitions.Type"))}</label>
          <div class="form-fields"><select name="type">${options}</select>
            <button type="button" data-action="previewGlobal" data-tooltip="DND5E_LUMIERE.Transitions.Preview"><i class="fa-solid fa-play"></i></button></div>
        </div>
        <div class="form-group">
          <label>${esc(loc("DND5E_LUMIERE.Transitions.Duration"))} <span class="units">(ms)</span></label>
          <div class="form-fields"><input type="number" name="duration" min="500" max="10000" step="100"
            value="${global.duration ?? ""}" placeholder="${dur ?? ""}"></div>
        </div>
        <div class="form-group">
          <label>${esc(loc("DND5E_LUMIERE.Transitions.ActiveOnly"))}</label>
          <div class="form-fields"><input type="checkbox" name="activeOnly" ${global.activeOnly ? "checked" : ""}></div>
          <p class="hint">${esc(loc("DND5E_LUMIERE.Transitions.ActiveOnlyHint"))}</p>
        </div>
        <div class="form-group">
          <label>${esc(loc("DND5E_LUMIERE.Transitions.Override"))}</label>
          <div class="form-fields"><input type="checkbox" name="override" ${global.override ? "checked" : ""}></div>
          <p class="hint">${esc(loc("DND5E_LUMIERE.Transitions.OverrideHint"))}</p>
        </div>
        <button type="button" data-action="saveGlobal"><i class="fa-solid fa-floppy-disk"></i> ${esc(loc("DND5E_LUMIERE.Transitions.Save"))}</button>
      </fieldset>
      <fieldset>
        <legend>${esc(loc("DND5E_LUMIERE.Transitions.List"))}</legend>
        <table>
          <thead><tr><th>${esc(loc("DND5E_LUMIERE.Transitions.Name"))}</th><th>${esc(loc("DND5E_LUMIERE.Transitions.Effect"))}</th>
            <th>${esc(loc("DND5E_LUMIERE.Transitions.Duration"))}</th><th>${esc(loc("DND5E_LUMIERE.Transitions.Source"))}</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="hint">${esc(loc("DND5E_LUMIERE.Transitions.ImportHint"))}</p>
        <div class="dl-row">
          <button type="button" data-action="import"><i class="fa-solid fa-file-import"></i> ${esc(loc("DND5E_LUMIERE.Transitions.Import"))}</button>
          <button type="button" data-action="exportAll" ${customTransitions().length ? "" : "disabled"}>
            <i class="fa-solid fa-file-export"></i> ${esc(loc("DND5E_LUMIERE.Transitions.ExportAll"))}</button>
          <input type="file" accept=".json,application/json" hidden>
        </div>
      </fieldset>`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    result.querySelectorAll("[data-action]").forEach(b => b.addEventListener("click", ev => this.#onAction(ev)));
    result.querySelector('input[type="file"]').addEventListener("change", ev => this.#onFile(ev));
  }

  async #onAction(event) {
    const button = event.currentTarget;
    const row = button.closest("tr");
    const form = this.element;
    switch ( button.dataset.action ) {
      case "preview": return this.#preview(row.dataset.key);
      case "previewGlobal": {
        const type = form.querySelector('[name="type"]').value;
        const duration = Number(form.querySelector('[name="duration"]').value) || undefined;
        if ( type ) return this.#preview(type, duration);
        return;
      }
      case "saveGlobal": return this.#saveGlobal();
      case "exportOne": return this.#export(dasTransitions().filter(t => t.key === row.dataset.key), row.dataset.id);
      case "exportAll": return this.#export(dasTransitions().filter(t => !t.builtIn), "world");
      case "import": return form.querySelector('input[type="file"]').click();
      case "remove": return this.#remove(row.dataset.id);
    }
  }

  /** L'aperçu se joue sur le canvas, derrière la fenêtre : on la réduit le temps de l'effet. */
  async #preview(key, duration) {
    if ( !canvas.ready ) return ui.notifications.warn("DND5E_LUMIERE.Transitions.NoCanvas", { localize: true });
    await this.minimize();
    try { await previewTransition(key, { duration }); }
    finally { await this.maximize(); }
  }

  async #saveGlobal() {
    const form = this.element;
    const duration = Number(form.querySelector('[name="duration"]').value);
    await game.settings.set(MODULE_ID, "globalTransition", {
      type: form.querySelector('[name="type"]').value,
      duration: Number.isFinite(duration) && (duration >= 500) ? Math.min(10000, duration) : null,
      activeOnly: form.querySelector('[name="activeOnly"]').checked,
      override: form.querySelector('[name="override"]').checked
    });
    ui.notifications.info("DND5E_LUMIERE.Transitions.Saved", { localize: true });
  }

  /** Les transitions livrées sont exportées comme modèles : nouvel id, libellé traduit. */
  #export(list, name) {
    if ( !list.length ) return;
    const entries = list.map(t => t.builtIn ? { ...t, id: `my${t.id[0].toUpperCase()}${t.id.slice(1)}` }
      : customTransitions().find(c => c.id === t.id) ?? t);
    const data = exportTransitionFile(entries);
    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "application/json", `das-transitions-${name}.json`);
  }

  async #onFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if ( !file ) return;
    let data;
    try { data = JSON.parse(await file.text()); }
    catch(err) {
      return ui.notifications.error(loc("DND5E_LUMIERE.Transitions.BadJson", { error: err.message }));
    }
    const { transitions, errors, warnings } = parseTransitionFile(data);
    for ( const w of warnings ) console.warn(`${MODULE_ID} | ${file.name}: ${w}`);
    for ( const e of errors ) console.error(`${MODULE_ID} | ${file.name}: ${e}`);
    if ( errors.length ) {
      ui.notifications.error(loc("DND5E_LUMIERE.Transitions.ImportErrors", { count: errors.length, first: errors[0] }));
    }
    if ( !transitions.length ) return;
    const { list, added, replaced } = mergeTransitions(customTransitions(), transitions);
    await game.settings.set(MODULE_ID, "customTransitions", list);
    ui.notifications.info(loc("DND5E_LUMIERE.Transitions.ImportDone", { added, replaced, warnings: warnings.length }));
  }

  async #remove(id) {
    const entry = customTransitions().find(t => t.id === id);
    if ( !entry ) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "DND5E_LUMIERE.Transitions.Remove" },
      content: `<p>${esc(loc("DND5E_LUMIERE.Transitions.RemoveConfirm", { id }))}</p>`
    });
    if ( !ok ) return;
    await game.settings.set(MODULE_ID, "customTransitions", customTransitions().filter(t => t.id !== id));
  }
};

/** Redessine la fenêtre si elle est ouverte (après un changement des réglages, sur tous les clients). */
export function refreshTransitionsApp() {
  foundry.applications.instances.get("dnd5e-lumiere-transitions")?.render();
}
