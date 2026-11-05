/**
 * Catégories des réglages : Shadows & Ambience range ses réglages en sous-onglets dans la fenêtre de réglages de la suite DAS,
 * déclarée par l'API publique de DAS · Core (`api.settings.registerWindow`, moteur ≥ 0.241.0), comme Combat UI. Au `setup`, quand
 * tous les modules ont posé leur API. DAS · Core est requis (module.json, ≥ 0.241.0, décision de l'utilisateur 2026-11-05) ; si son
 * API manque quand même (moteur désactivé à la main) ou refuse la déclaration, les réglages restent dans la liste de Foundry.
 */

import { SETTINGS_TABS } from "../core/settings-tabs.mjs";
import { MODULE_ID } from "../settings.mjs";
import { TransitionsApp } from "./transitions-app.mjs";

const TAB_LABELS = Object.freeze({
  shadows: "DND5E_LUMIERE.SettingsWindow.Tab.shadows",
  movement: "DND5E_LUMIERE.SettingsWindow.Tab.movement",
  vision: "DND5E_LUMIERE.SettingsWindow.Tab.vision",
  sounds: "DND5E_LUMIERE.SettingsWindow.Tab.sounds",
  transitions: "DND5E_LUMIERE.SettingsWindow.Tab.transitions"
});

const TOOLS = Object.freeze({
  transitions: {
    name: "DND5E_LUMIERE.Transitions.Menu.Name",
    hint: "DND5E_LUMIERE.Transitions.Menu.Hint",
    button: "DND5E_LUMIERE.Transitions.Menu.Label",
    open: () => new (TransitionsApp())().render({ force: true })
  }
});

export function registerSettingsWindow() {
  Hooks.once("setup", () => {
    const register = game.modules.get("dnd5e-combat")?.api?.settings?.registerWindow;
    if ( typeof register !== "function" ) return;
    try {
      register({
        namespace: MODULE_ID,
        tabs: SETTINGS_TABS.map(t => ({ ...t, label: TAB_LABELS[t.id],
          tools: (t.tools ?? []).map(tool => ({ ...tool, ...TOOLS[tool.id] })) }))
      });
    } catch ( err ) {
      // Déclaration refusée : la liste de Foundry reste, rien n'est perdu.
      console.warn(`${MODULE_ID} | settings window not declared`, err);
      return;
    }
    // Le bouton « Transitions » passe dans la fenêtre (onglet Transitions) : il quitte la liste de Foundry.
    game.settings.menus.delete(`${MODULE_ID}.transitionsMenu`);
  });
}
