/**
 * Issue #4 — un token regarde à gauche ou à droite selon son déplacement. Purement visuel et local : rien n'est écrit
 * (`texture.scaleX` reste intact), on ne fait que retourner l'image affichée (`token.mesh`) sur ce client.
 *
 * - Le sens suit le mouvement **visuel** : à chaque `refreshPosition` (une image de l'animation du cœur), on compare
 *   l'abscisse affichée du token (`document.x`, animée) à la précédente. Le token se retourne donc au début d'un pas et à
 *   chaque virage d'un chemin, et une téléportation (`blink`, sans animation) le tourne vers sa destination.
 * - Un déplacement forcé (`displace`) garde le sens : `moveToken` (client/hooks.mjs:735) le signale avant que la nouvelle
 *   position ne soit dessinée, et le pas qui suit n'est pas compté.
 * - Le miroir est un facteur horizontal que `perspective.mjs` multiplie à l'échelle du cœur (le seul endroit qui pose
 *   `mesh.scale`) : le miroir horizontal du token et la tête en bas du plafond (DAS · Core, `texture.scaleY`) sont dans
 *   l'échelle de base et se combinent avec lui.
 * - Rotation : un token qui se retourne garde son image droite, comme avec « Verrouiller la rotation » du cœur
 *   (`mesh.angle = lockRotation ? 0 : rotation`, token.mjs:1587). Sa rotation enregistrée reste celle de la vision.
 * - Le sens n'est gardé nulle part : après un rechargement, l'image reprend son sens dessiné jusqu'au pas suivant.
 */

import { artOf, FACING_DEFAULTS, facingActive, keepsFacing, nextMirror, turnFactor, turnProgress } from "../core/facing.mjs";
import { MODULE_ID, setting } from "../settings.mjs";
import { visualState } from "./state.mjs";

export const FACING_FLAG = "facing";

/** Tokens en plein demi-tour. */
const turning = new Set();
let tickerAdded = false;
/** Appelé à chaque image d'un demi-tour pour reposer l'échelle (perspective.mjs). */
let onTurnFrame = null;

export function registerFacing(redraw) {
  onTurnFrame = redraw;
}

function flagOf(token) {
  return token.document.flags?.[MODULE_ID]?.[FACING_FLAG];
}

export function isFacingActive(token) {
  return facingActive(flagOf(token), setting("flipTokens"));
}

/**
 * Facteur horizontal à multiplier à l'échelle du token : 1 tel que dessiné, −1 retourné, entre les deux pendant un demi-tour.
 * @param {Token} token
 */
export function facingScale(token) {
  const state = visualState(token);
  if ( !isFacingActive(token) ) return 1;
  const mirror = state.mirror ?? 1;
  const turn = state.turn;
  if ( !turn ) return mirror;
  return turnFactor(turn.from, turn.to, turnProgress(turn.started, now()));
}

/**
 * À chaque `drawToken` / `refreshToken` : lit le pas horizontal, retourne le token s'il le faut, et tient l'image droite.
 * @param {Token} token
 * @param {object} [flags]
 */
export function trackFacing(token, flags) {
  if ( token.destroyed || !token.mesh || token.mesh.destroyed ) return;
  const state = visualState(token);
  const { x, y } = token.document;
  const active = isFacingActive(token);

  if ( (state.facingX === undefined) || !active ) {
    state.facingX = x;
    state.facingY = y;
  } else if ( flags?.refreshPosition && ((x !== state.facingX) || (y !== state.facingY)) ) {
    const dx = x - state.facingX;
    state.facingX = x;
    state.facingY = y;
    // Déplacement forcé annoncé : ce saut-là ne compte pas (même s'il est purement vertical).
    if ( state.facingHold ) state.facingHold = false;
    else turnTo(token, state, nextMirror(state.mirror ?? 1, dx, artOf(flagOf(token)), FACING_DEFAULTS.threshold));
  }

  // Image droite tant que le token se retourne ; rotation du cœur rendue dès qu'il ne se retourne plus.
  if ( active ) {
    token.mesh.angle = 0;
    state.facingUpright = true;
  } else if ( state.facingUpright ) {
    state.facingUpright = false;
    state.mirror = 1;
    state.turn = null;
    turning.delete(token);
    token.mesh.angle = token.document.lockRotation ? 0 : token.document.rotation;
  }
}

/** `moveToken` : un déplacement fait seulement de pas forcés garde l'orientation. */
export function holdFacing(token, movement) {
  if ( !token || token.destroyed ) return;
  if ( !keepsFacing(movement?.passed?.waypoints) ) return;
  const state = visualState(token);
  // Le cœur lance l'animation dans `Token#_onUpdate`, avant ce hook : si la nouvelle position est déjà dessinée et l'a
  // retourné dans cette même image, on annule ce demi-tour ; sinon on ignore le prochain pas.
  const to = movement.destination;
  const drawn = to && (state.facingX === to.x) && (state.facingY === to.y);
  if ( !drawn ) state.facingHold = true;
  else if ( state.turn && (state.turn.started === now()) ) {
    state.mirror = Math.sign(state.turn.from) || 1;
    state.turn = null;
    turning.delete(token);
    onTurnFrame?.(token);
  }
}

export function removeFacing(token) {
  turning.delete(token);
}

function turnTo(token, state, mirror) {
  const current = state.mirror ?? 1;
  if ( mirror === current ) return;
  // Un demi-tour déjà en cours repart de là où l'image en est.
  const from = state.turn ? facingScale(token) : current;
  state.mirror = mirror;
  state.turn = { from, to: mirror, started: now() };
  turning.add(token);
  ensureTicker();
}

function now() {
  return canvas.app?.ticker?.lastTime ?? performance.now();
}

function ensureTicker() {
  if ( tickerAdded ) return;
  canvas.app.ticker.add(tick);
  tickerAdded = true;
}

function tick() {
  if ( !turning.size ) return;
  const time = now();
  for ( const token of turning ) {
    const state = visualState(token);
    if ( token.destroyed || !token.mesh || token.mesh.destroyed || !state.turn ) {
      turning.delete(token);
      continue;
    }
    if ( turnProgress(state.turn.started, time) >= 1 ) {
      state.turn = null;
      turning.delete(token);
    }
    onTurnFrame?.(token);
  }
}
