/**
 * État visuel par token, partagé entre les effets (flottement → ombre de contact). Jamais persisté.
 * @typedef {object} TokenVisualState
 * @property {number} lift     Hauteur actuelle du visuel au-dessus de sa position au sol, en pixels.
 * @property {number} height   Hauteur relative ∈ [0, 1] que l'ombre traduit (0 = au sol).
 * @property {boolean} [flying]      Cible d'envol : le token est-il en vol ?
 * @property {number} [flight]       Part d'envol ∈ [0, 1], qui suit la cible en douceur (décollage, atterrissage).
 * @property {number} [flightTime]   Heure du ticker à la dernière avancée de `flight`, en ms.
 * @property {{from: {x: number, y: number}, to: {x: number, y: number}, peak: number, started: number}|null} [jump]
 *   Saut en cours : centres de départ et d'arrivée, hauteur du sommet en pixels, heure du ticker au départ.
 */

/** @type {WeakMap<Token, TokenVisualState>} */
const states = new WeakMap();

/** @returns {TokenVisualState} */
export function visualState(token) {
  let s = states.get(token);
  if ( !s ) states.set(token, s = { lift: 0, height: 0 });
  return s;
}
