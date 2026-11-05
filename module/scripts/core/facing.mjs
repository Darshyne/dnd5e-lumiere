/**
 * Orientation gauche / droite d'un token selon son déplacement (issue #4). Calcul pur.
 *
 * Le « miroir » vaut 1 quand l'image est affichée telle que dessinée, −1 quand elle est retournée de gauche à droite.
 * Le sens dessiné (`art`) est celui de l'image telle que le token l'affiche, miroir horizontal du cœur compris.
 */

export const FACING_DEFAULTS = Object.freeze({
  art: "right",     // l'image regarde vers la droite
  threshold: 0.5,   // pas horizontal minimal pour changer de sens, en pixels (évite un retournement sur une vibration)
  turnMs: 150       // durée du demi-tour animé, en ms
});

export const FACING_MODES = Object.freeze(["setting", "always", "never"]);

/**
 * Le token se retourne-t-il selon son déplacement ?
 * @param {{mode?: string}|undefined} flag   Réglage du token (`flags.dnd5e-lumiere.facing`).
 * @param {boolean} worldOn                   Réglage du monde.
 */
export function facingActive(flag, worldOn) {
  if ( flag?.mode === "always" ) return true;
  if ( flag?.mode === "never" ) return false;
  return worldOn === true;
}

/** Sens dessiné de l'image : « left » ou « right » (par défaut). */
export function artOf(flag) {
  return flag?.art === "left" ? "left" : "right";
}

/**
 * Miroir voulu après un pas horizontal `dx` (pixels). Un pas trop petit, ou purement vertical, garde le miroir actuel.
 * @param {number} current   Miroir actuel (1 ou −1).
 * @param {number} dx        Déplacement horizontal du visuel depuis la dernière lecture.
 * @param {"left"|"right"} art
 */
export function nextMirror(current, dx, art = FACING_DEFAULTS.art, threshold = FACING_DEFAULTS.threshold) {
  if ( !(Math.abs(dx) > threshold) ) return current;
  const goesRight = dx > 0;
  return (goesRight === (art !== "left")) ? 1 : -1;
}

/**
 * Facteur horizontal pendant un demi-tour : l'image se resserre jusqu'à 0 puis s'ouvre dans l'autre sens.
 * @param {number} from   Miroir de départ (1 ou −1).
 * @param {number} to     Miroir d'arrivée.
 * @param {number} t      Avancement ∈ [0, 1].
 */
export function turnFactor(from, to, t) {
  if ( !(t < 1) ) return to;
  if ( !(t > 0) ) return from;
  const ease = (1 - Math.cos(Math.PI * t)) / 2;
  return from + ((to - from) * ease);
}

/** Avancement d'un demi-tour commencé à `started` (ms), à l'heure `now`. */
export function turnProgress(started, now, duration = FACING_DEFAULTS.turnMs) {
  if ( !(duration > 0) ) return 1;
  return Math.min(1, Math.max(0, (now - started) / duration));
}

/**
 * Un déplacement garde-t-il l'orientation ? Oui quand il n'est fait que de déplacements forcés (action `displace` du cœur :
 * une créature repoussée ne se retourne pas). Une téléportation (`blink`) tourne le token vers sa destination.
 * @param {Array<{action?: string}>} waypoints   Étapes parcourues (`movement.passed.waypoints`).
 */
export function keepsFacing(waypoints) {
  return Array.isArray(waypoints) && (waypoints.length > 0) && waypoints.every(w => w?.action === "displace");
}
