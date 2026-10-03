/**
 * Hauteur du visuel au-dessus de son ombre : décalage dû à l'élévation (étape 3) + flottement des
 * créatures en vol (étape 2), qui s'installe et se retire en douceur (décollage, atterrissage) + arc d'un
 * saut (étape 10), le temps du déplacement fait en sautant.
 *
 * « En vol » = statut spécial FLY ou HOVER (le cœur les nomme dans `CONFIG.specialStatusEffects`,
 * client/config.mjs:1920-1928 ; dnd5e les remplace par ses statuts `flying` et `hovering`, dnd5e.mjs:454),
 * ou action de déplacement `fly` du token (common/documents/token.mjs:131) si la créature a une vitesse de
 * vol. L'élévation seule ne fait pas flotter (un token sur un balcon ne vole pas) : elle décale seulement.
 *
 * Un seul ticker pour tout le module, qui ne parcourt que les tokens en vol ou en train de décoller ou de
 * se poser. Le cœur remet `mesh.position` au centre du token à chaque `refreshPosition`
 * (token.mjs:1549-1556) ; on repose donc la hauteur après lui, dans `refreshToken`, puis à chaque frame —
 * toujours à partir de `token.center`, jamais en cumulant sur l'ancienne valeur.
 */

import { approachFlight, flightEase, hoverLift, phaseFromId } from "../core/hover.mjs";
import { jumpLift, jumpPeak, jumpProgress } from "../core/jump.mjs";
import { elevationLift, shadowHeight } from "../core/perspective.mjs";
import { setting } from "../settings.mjs";
import { syncContactShadow } from "./contact-shadow.mjs";
import { heightAboveGround } from "./elevation.mjs";
import { visualState } from "./state.mjs";

/** Tokens en vol, ou dont la part d'envol n'est pas encore retombée à 0. */
const airborne = new Set();
let tickerAdded = false;

export function isFlying(token) {
  const { FLY, HOVER } = CONFIG.specialStatusEffects;
  const doc = token.document;
  if ( doc.hasStatusEffect(FLY) || doc.hasStatusEffect(HOVER) ) return true;
  // L'action choisie persiste d'un déplacement à l'autre : vu en jeu le 2026-09-26, un Bandit resté en
  // `fly` sans rien savoir voler. On ne la croit que si la créature a une vitesse de vol (dnd5e).
  if ( doc.movementAction !== "fly" ) return false;
  const speed = doc.actor?.system?.attributes?.movement?.fly;
  return (speed === undefined) || (Number(speed) > 0);
}

/** À drawToken / refreshToken : met à jour la cible d'envol et repose la hauteur. */
export function syncHeight(token) {
  if ( !usable(token) ) return;
  const state = visualState(token);
  state.flying = setting("hover") && isFlying(token);
  // Premier dessin (ouverture de la scène) : déjà en l'air ou déjà posé, pas de décollage.
  state.flight ??= state.flying ? 1 : 0;
  if ( state.flying || (state.flight > 0) || state.jump ) {
    airborne.add(token);
    ensureTicker();
  } else airborne.delete(token);
  applyHeight(token, canvas.app.ticker.lastTime);
}

/** Délai de grâce : l'animation du cœur ne démarre pas à l'instant où le déplacement est noté. */
const JUMP_GRACE_MS = 250;

/**
 * Un déplacement vient d'être noté (hook `moveToken`, client/hooks.mjs:735) : s'il se finit en sautant (action `jump` de
 * la dernière étape parcourue — « Sauter ici » du moteur de combat, ou l'action choisie dans le HUD du token), le visuel
 * décrira un arc de la position d'avant à celle d'arrivée. Rien n'est écrit : on ne fait que lire le mouvement.
 */
export function startJump(token, movement) {
  if ( !usable(token) || !setting("jump") ) return;
  const waypoints = movement?.passed?.waypoints ?? [];
  const last = waypoints.at(-1);
  if ( last?.action !== "jump" ) return;
  const start = waypoints.at(-2) ?? movement.origin;
  if ( !start ) return;
  const half = { x: token.w / 2, y: token.h / 2 };
  const from = { x: start.x + half.x, y: start.y + half.y };
  const to = { x: last.x + half.x, y: last.y + half.y };
  const peak = jumpPeak(Math.hypot(to.x - from.x, to.y - from.y), canvas.grid.size, { height: setting("jumpHeight") });
  if ( !(peak > 0) ) return;
  visualState(token).jump = { from, to, peak, started: canvas.app.ticker.lastTime };
  airborne.add(token);
  ensureTicker();
}

export function removeHeight(token) {
  airborne.delete(token);
}

function usable(token) {
  return !token.destroyed && token.mesh && !token.mesh.destroyed;
}

function ensureTicker() {
  if ( tickerAdded ) return;
  canvas.app.ticker.add(tick);
  tickerAdded = true;
}

function tick() {
  if ( !airborne.size ) return;
  const time = canvas.app.ticker.lastTime;
  for ( const token of airborne ) {
    if ( !usable(token) ) {
      airborne.delete(token);
      continue;
    }
    const state = visualState(token);
    const dt = time - (state.flightTime ?? time);
    state.flightTime = time;
    state.flight = approachFlight(state.flight ?? 0, state.flying, dt);
    if ( state.jump ) {
      // Arrivé, ou l'animation du cœur a pris fin (ou n'a jamais commencé : onglet masqué, déplacement sans animation).
      const moving = token.animationContexts?.has(token.movementAnimationName) === true;
      const t = jumpProgress(state.jump.from, state.jump.to, token.center);
      if ( (t >= 1) || (!moving && ((time - state.jump.started) > JUMP_GRACE_MS)) ) state.jump = null;
    }
    const landed = !state.flying && (state.flight <= 0) && !state.jump;
    if ( landed ) {
      airborne.delete(token);
      state.flightTime = undefined;
    }
    if ( !token.mesh.visible ) continue;
    applyHeight(token, time);
    syncContactShadow(token);
  }
}

function applyHeight(token, time) {
  const { height } = token.document.getSize();
  const state = visualState(token);
  let lift = 0;
  if ( setting("perspective") ) {
    const grid = { distance: canvas.grid.distance, size: canvas.grid.size };
    lift += elevationLift(heightAboveGround(token), grid, { maxLift: setting("elevationLift") });
  }
  const w = flightEase(state.flight ?? 0);
  if ( w > 0 ) {
    const options = { lift: setting("hoverLift"), amplitude: setting("hoverAmplitude") };
    lift += w * hoverLift(time, height, phaseFromId(token.document.id ?? token.objectId), options).lift;
  }
  if ( state.jump ) lift += jumpLift(jumpProgress(state.jump.from, state.jump.to, token.center), state.jump.peak);
  token.mesh.position.y = token.center.y - lift;
  state.lift = lift;
  state.height = shadowHeight(lift, height);
}
