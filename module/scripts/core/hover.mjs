/**
 * Flottement des créatures en vol : le visuel monte d'une hauteur de base et oscille autour, l'ombre
 * reste au sol et répond (plus petite et plus pâle quand le token est plus haut). Calcul pur.
 */

export const HOVER_DEFAULTS = Object.freeze({
  lift: 0.12,       // hauteur de base au-dessus de l'ombre, en fraction de la hauteur du token
  amplitude: 0.04,  // amplitude de l'oscillation, même unité
  period: 3200,     // ms pour un aller-retour complet
  shadowShrink: 0.25, // à la hauteur maximale, l'ombre perd 25 % de sa taille…
  shadowFade: 0.35,   // … et 35 % de son opacité
  takeoff: 700,       // ms pour prendre son envol (hauteur de vol et flottement s'installent)…
  landing: 500        // … et pour se poser
});

/**
 * Avance la part d'envol vers sa cible, à vitesse constante : 0 = posé, 1 = en vol.
 * @param {number} current   Part d'envol actuelle ∈ [0, 1].
 * @param {boolean} flying   Cible : en vol ou posé.
 * @param {number} dt        Temps écoulé depuis la dernière image, en ms.
 * @param {Partial<typeof HOVER_DEFAULTS>} [options]
 * @returns {number}
 */
export function approachFlight(current, flying, dt, options = {}) {
  const { takeoff, landing } = { ...HOVER_DEFAULTS, ...options };
  const target = flying ? 1 : 0;
  const duration = flying ? takeoff : landing;
  if ( !(duration > 0) || !(dt >= 0) ) return target;
  const step = dt / duration;
  return (current < target) ? Math.min(target, current + step) : Math.max(target, current - step);
}

/**
 * Courbe de la part d'envol (départ et arrivée en douceur).
 * @param {number} w   Part d'envol ∈ [0, 1].
 */
export function flightEase(w) {
  const x = Math.min(1, Math.max(0, w));
  return x * x * (3 - (2 * x));
}

/**
 * Phase stable dérivée de l'id du token, pour que deux créatures en vol ne flottent pas en chœur.
 * @param {string} id
 * @returns {number} Radians dans [0, 2π).
 */
export function phaseFromId(id) {
  let h = 2166136261;
  for ( let i = 0; i < id.length; i++ ) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

/**
 * Hauteur du visuel au-dessus de sa position au sol, à un instant donné.
 * @param {number} timeMs
 * @param {number} tokenHeight    Hauteur du token en pixels.
 * @param {number} phase
 * @param {Partial<typeof HOVER_DEFAULTS>} [options]
 * @returns {{lift: number, ratio: number}}  `lift` en pixels (vers le haut), `ratio` ∈ [0, 1] :
 *   0 au point le plus bas de l'oscillation, 1 au plus haut.
 */
export function hoverLift(timeMs, tokenHeight, phase, options = {}) {
  const { lift, amplitude, period } = { ...HOVER_DEFAULTS, ...options };
  const wave = Math.sin((timeMs / period) * Math.PI * 2 + phase);
  return {
    lift: tokenHeight * (lift + amplitude * wave),
    ratio: (wave + 1) / 2
  };
}

/**
 * Réponse de l'ombre de contact à la hauteur : facteurs d'échelle et d'opacité.
 * @param {number} height   Hauteur relative ∈ [0, 1] (0 = au sol, 1 = hauteur maximale considérée).
 * @param {Partial<typeof HOVER_DEFAULTS>} [options]
 */
export function shadowResponse(height, options = {}) {
  const { shadowShrink, shadowFade } = { ...HOVER_DEFAULTS, ...options };
  const h = Math.min(1, Math.max(0, height));
  return { scale: 1 - shadowShrink * h, alpha: 1 - shadowFade * h };
}
