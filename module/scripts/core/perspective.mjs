/**
 * Perspective selon l'élévation (étape 3). Calcul pur : distances en unités de scène (pieds) ou en
 * pixels, précisées à chaque fonction.
 *
 * - Décalage : un token au-dessus du sol de son level est dessiné plus haut que son ombre.
 * - Échelle : relative à celui qui regarde (son token contrôlé, sinon son personnage, sinon le sol) —
 *   plus haut que lui paraît plus grand, plus bas plus petit, dans des bornes étroites.
 * - Transparence : un token plus haut que la référence, qui recouvre un token plus bas, s'estompe.
 */

export const PERSPECTIVE_DEFAULTS = Object.freeze({
  liftPerCell: 0.1,   // décalage par case d'élévation, en cases (30 ft sur une grille de 5 ft → 0,6 case)
  maxLift: 0.75,      // décalage maximal, en cases
  scalePerCell: 0.04, // variation d'échelle par case d'écart avec la référence
  maxScale: 0.2,      // écart d'échelle maximal (0,2 → entre 0,8 et 1,2)
  fadeAlpha: 0.5,     // opacité d'un token haut qui en recouvre un plus bas
  overlap: 0.75       // deux tokens se recouvrent si leurs centres sont à moins de 75 % de la somme des rayons
});

/**
 * Décalage vertical dû à l'élévation, en pixels.
 * @param {number} height        Élévation au-dessus du sol du level, en unités de scène.
 * @param {{distance: number, size: number}} grid  Taille d'une case en unités de scène et en pixels.
 */
export function elevationLift(height, grid, options = {}) {
  const { liftPerCell, maxLift } = { ...PERSPECTIVE_DEFAULTS, ...options };
  if ( !(height > 0) || !(grid.distance > 0) ) return 0;
  return grid.size * Math.min(maxLift, liftPerCell * (height / grid.distance));
}

/**
 * Facteur d'échelle pour un token vu depuis la référence.
 * @param {number} delta          Élévation du token − élévation de référence, en unités de scène.
 * @param {number} gridDistance   Taille d'une case en unités de scène.
 */
export function perspectiveScale(delta, gridDistance, options = {}) {
  const { scalePerCell, maxScale } = { ...PERSPECTIVE_DEFAULTS, ...options };
  if ( !delta || !(gridDistance > 0) ) return 1;
  const change = scalePerCell * (delta / gridDistance);
  return 1 + Math.min(maxScale, Math.max(-maxScale, change));
}

/**
 * Deux tokens se recouvrent-ils à l'écran ? Disques centrés, rayons en pixels.
 * @param {{x: number, y: number, r: number}} a
 * @param {{x: number, y: number, r: number}} b
 */
export function overlaps(a, b, options = {}) {
  const { overlap } = { ...PERSPECTIVE_DEFAULTS, ...options };
  return Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * overlap;
}

/**
 * Hauteur relative que l'ombre traduit (0 = au sol, 1 = une demi-hauteur de token ou plus).
 * @param {number} liftPx        Hauteur totale du visuel au-dessus de l'ombre, en pixels.
 * @param {number} tokenHeight   Hauteur du token en pixels.
 */
export function shadowHeight(liftPx, tokenHeight) {
  if ( !(liftPx > 0) || !(tokenHeight > 0) ) return 0;
  return Math.min(1, liftPx / (0.5 * tokenHeight));
}

/**
 * Opacité d'un token avec l'estompage de ce module, sans écraser celle que posent le cœur ou un autre module
 * (Monk's Bloodsplats rend un mort translucide : support Discord du 2026-11-17).
 *
 * L'opacité trouvée sur le mesh est la base, sauf si c'est encore celle que ce module a posée : la base d'alors
 * reste juste. Sans estompage, on ne touche à rien, sauf pour retirer un estompage encore en place.
 * @param {number} current     Opacité actuelle du mesh.
 * @param {{base: number, written: number}|null} memo  Ce que ce module a posé la dernière fois (null : rien).
 * @param {boolean} fade       Le token doit-il être estompé ?
 * @param {number} fadeAlpha   Facteur d'estompage.
 * @returns {{alpha: number|null, memo: {base: number, written: number}|null}}  `alpha` null : ne rien écrire.
 */
export function fadedAlpha(current, memo, fade, fadeAlpha) {
  const ours = !!memo && (current === memo.written);
  const base = ours ? memo.base : current;
  if ( !fade ) return { alpha: ours ? base : null, memo: null };
  const alpha = base * fadeAlpha;
  return { alpha, memo: { base, written: alpha } };
}
