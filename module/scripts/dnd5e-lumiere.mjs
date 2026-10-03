/**
 * Ombres et ambiance (dnd5e-lumiere, ex « Vision et lumière ») — point d'entrée.
 *
 * Tout ce que fait ce module est visuel et local au client : rien n'est jamais écrit dans un
 * document. Voir SPEC.md à la racine du dépôt.
 *
 * Les hooks sont posés ici, une fois, dans un ordre fixe : hauteur du visuel (élévation + vol), puis
 * ombre de contact (qui traduit cette hauteur), ombres portées par les lumières, puis perspective
 * (échelle, transparence).
 */

import { refreshAllCastShadows, removeCastShadows, syncCastShadows } from "./canvas/cast-shadows.mjs";
import { removeContactShadow, syncContactShadow } from "./canvas/contact-shadow.mjs";
import { markDirty as refreshDarkvisionBlur, registerDarkvisionBlur } from "./canvas/darkvision-blur.mjs";
import { referenceToken } from "./canvas/elevation.mjs";
import { removeHeight, startJump, syncHeight } from "./canvas/hover.mjs";
import { removePerspective, syncElevatedAround, syncPerspective } from "./canvas/perspective.mjs";
import { invalidateSun } from "./canvas/sun.mjs";
import { MODULE_ID, registerSettings } from "./settings.mjs";
import { registerLightConfig } from "./ui/light-config.mjs";
import { registerSceneConfig } from "./ui/scene-config.mjs";

function syncToken(token, flags) {
  syncHeight(token);
  syncContactShadow(token);
  syncCastShadows(token);
  syncPerspective(token, flags);
}

function refreshAll() {
  if ( !canvas.ready ) return;
  invalidateSun();
  for ( const token of canvas.tokens.placeables ) syncToken(token);
  refreshDarkvisionBlur();
}

// Sélectionner plusieurs tokens déclenche un controlToken par token : un seul recalcul suffit.
const refreshAllSoon = foundry.utils.debounce(refreshAll, 30);

/** Le soleil a peut-être bougé : heure, scène, éclairage. Regroupé (le temps avance par rafales). */
function refreshSun() {
  invalidateSun();
  refreshAllCastShadows();
}
const refreshSunSoon = foundry.utils.debounce(refreshSun, 100);

Hooks.once("init", () => {
  registerSettings(refreshAll);
  registerLightConfig();
  registerSceneConfig();
  registerDarkvisionBlur();

  Hooks.on("drawToken", token => syncToken(token));
  Hooks.on("refreshToken", (token, flags) => {
    syncToken(token, flags);
    // La référence de ce client a changé de hauteur : toute la perspective change avec elle.
    if ( flags.refreshElevation && (token === referenceToken()) ) refreshAllSoon();
    // Un token a bougé : ceux qui sont en hauteur le recouvrent peut-être, ou plus.
    else if ( flags.refreshPosition || flags.refreshElevation ) syncElevatedAround(token);
  });
  Hooks.on("destroyToken", token => {
    removeHeight(token);
    removePerspective(token);
    removeContactShadow(token);
    removeCastShadows(token);
  });
  // Une lumière a bougé, changé ou s'est éteinte (effects.mjs:274) : toutes les ombres portées changent.
  // Elle suit aussi un changement d'obscurité (environment.mjs:194) : le plein jour, donc le soleil, a pu changer.
  Hooks.on("lightingRefresh", () => refreshSun());
  // Nouvelle scène : le soleil gardé est celui de l'ancienne.
  Hooks.on("canvasInit", () => invalidateSun());
  // L'heure du monde a avancé (helpers/time.mjs:218) ; Simple Timekeeping avance cette même heure.
  Hooks.on("updateWorldTime", () => refreshSunSoon());
  // Soleil coupé ou nord changé dans la configuration de la scène affichée.
  Hooks.on("updateScene", (scene, changes) => {
    if ( (scene === canvas.scene) && foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) ) refreshSun();
  });
  // Changer seulement la hauteur d'une lumière (un flag) ne réinitialise pas sa source : pas de lightingRefresh.
  Hooks.on("updateAmbientLight", (doc, changes) => {
    if ( foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) ) refreshAllCastShadows();
  });
  // Changer d'action de déplacement (marche → vol) ne déclenche aucun rafraîchissement du token.
  Hooks.on("updateToken", (doc, changes) => {
    if ( ("movementAction" in changes) && doc.object ) syncToken(doc.object);
    // Hauteur de la lumière portée (un flag) : sa source n'est pas réinitialisée, pas de lightingRefresh.
    if ( foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) ) refreshAllCastShadows();
  });
  // Un déplacement fait en sautant : le visuel décrit un arc (client/hooks.mjs:735, sur tous les clients).
  Hooks.on("moveToken", (doc, movement) => {
    if ( doc.object ) startJump(doc.object, movement);
  });
  // Changer de token contrôlé change la référence de la perspective.
  Hooks.on("controlToken", () => refreshAllSoon());
  // Survoler un token estompé le rend opaque le temps du survol.
  Hooks.on("hoverToken", token => syncPerspective(token));
});

Hooks.once("ready", () => {
  // La scène est dessinée avant `ready` ; Simple Timekeeping ne crée son instance (aube, crépuscule) qu'à son propre
  // `ready`, peut-être après le nôtre : le soleil est recalculé juste après.
  refreshSunSoon();
  console.log(`${MODULE_ID} | prêt`);
});
