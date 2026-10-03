/**
 * Saut : pendant un déplacement fait en sautant, le visuel décrit un arc au-dessus de son ombre, qui reste au sol et
 * rétrécit sous lui. Calcul pur — la progression se lit sur la position animée du token, pas sur une horloge : l'arc suit
 * l'animation du cœur quelle que soit sa vitesse.
 */

export const JUMP_DEFAULTS = Object.freeze({
  height: 0.35,     // hauteur du sommet, en fraction de la longueur du saut
  minHeight: 0.3,   // … jamais moins (en cases) : un saut d'une case se voit quand même
  maxHeight: 1.25   // … ni plus (en cases) : un long saut ne sort pas de l'écran
});

/**
 * Hauteur du sommet de l'arc, en pixels.
 * @param {number} distance   Longueur du saut au sol, en pixels.
 * @param {number} gridSize   Taille d'une case, en pixels.
 * @param {Partial<typeof JUMP_DEFAULTS>} [options]
 */
export function jumpPeak(distance, gridSize, options = {}) {
  const { height, minHeight, maxHeight } = { ...JUMP_DEFAULTS, ...options };
  if ( !(distance > 0) || !(gridSize > 0) || !(height > 0) ) return 0;
  return Math.min(maxHeight * gridSize, Math.max(minHeight * gridSize, distance * height));
}

/**
 * Où en est le saut : la position animée projetée sur le segment départ → arrivée.
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {{x: number, y: number}} at   Position actuelle (animée).
 * @returns {number}  ∈ [0, 1] ; 1 si le segment est nul.
 */
export function jumpProgress(from, to, at) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = (dx * dx) + (dy * dy);
  if ( !(length > 0) ) return 1;
  const t = (((at.x - from.x) * dx) + ((at.y - from.y) * dy)) / length;
  return Math.min(1, Math.max(0, t));
}

/**
 * Hauteur du visuel au-dessus du sol à ce point du saut : une parabole, nulle au départ et à l'arrivée.
 * @param {number} t      Progression ∈ [0, 1].
 * @param {number} peak   Hauteur du sommet, en pixels.
 */
export function jumpLift(t, peak) {
  const x = Math.min(1, Math.max(0, t));
  return peak * 4 * x * (1 - x);
}
