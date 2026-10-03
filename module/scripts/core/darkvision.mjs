/**
 * Vision dans le noir : flou au-delà de la portée (décision de l'utilisateur, 2026-09-26 — « gris net et
 * flou au-delà »). Calcul pur.
 *
 * Règle 2024 : à portée, la lumière faible est vue comme vive et les ténèbres comme de la lumière faible,
 * en nuances de gris — le mode de vision « darkvision » du cœur le rend déjà. Au-delà de la portée, la
 * lumière faible reste de la lumière faible (visibilité réduite) : c'est elle qu'on floute. Ce qui reste
 * net : le disque de vision dans le noir de chaque token d'où l'on regarde, et les zones de lumière vive.
 */

export const DARKVISION_DEFAULTS = Object.freeze({
  blur: 3,          // rayon du flou, en pixels d'écran
  maskMax: 2048,    // plus grand côté du masque, en texels
  feather: 0.5      // fondu du bord des zones nettes, en cases
});

/**
 * Échelle du masque (texels par pixel de scène) : toute la scène dans au plus `max` texels de côté.
 * Le masque est flou par nature, une résolution réduite suffit.
 */
export function maskScale(width, height, max = DARKVISION_DEFAULTS.maskMax) {
  const side = Math.max(width, height);
  if ( !(side > 0) ) return 1;
  return Math.min(1, max / side);
}

/**
 * Matrice 3×3 (colonnes, pour un `mat3` GLSL) qui passe d'un point d'écran aux coordonnées du masque
 * (0–1), à partir de la transformation monde → écran du canvas `{a, b, c, d, tx, ty}`.
 * @returns {Float32Array|null}  `null` si la transformation n'est pas inversible.
 */
export function screenToMaskMatrix({ a, b, c, d, tx, ty }, width, height) {
  const det = (a * d) - (b * c);
  if ( !det || !(width > 0) || !(height > 0) ) return null;
  // Inverse de [a c tx; b d ty; 0 0 1]
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  const itx = ((c * ty) - (d * tx)) / det;
  const ity = ((b * tx) - (a * ty)) / det;
  return new Float32Array([
    ia / width, ib / height, 0,
    ic / width, id / height, 0,
    itx / width, ity / height, 1
  ]);
}

/**
 * Le token apporte-t-il une zone nette de vision dans le noir ?
 * @param {{visionMode: string, range: number, hasSight: boolean}} sight
 */
export function grantsDarkvision({ visionMode, range, hasSight }) {
  return Boolean(hasSight) && (visionMode === "darkvision") && (range > 0);
}

/**
 * Plein jour : la lumière globale est active, **vive**, et l'obscurité de la scène est dans sa plage `darkness` — hors de
 * cette plage, le cœur ne l'applique pas (il ne la teste que dans son shader, sources/global-light-source.mjs:76-80, et dans
 * `EffectsCanvasGroup#testInsideLight`, groups/effects.mjs:331-337 ; `active` n'en tient pas compte). Une lumière globale
 * faible (`bright: 0`, groups/environment.mjs:320-331) n'est jamais du plein jour. Même arbitrage que le moteur de combat
 * (`dnd5e-combat/module/scripts/adapter/illumination.mjs`).
 * @param {{active: boolean, bright: number, darkness?: {min?: number, max?: number}}} global
 * @param {number} darknessLevel   Obscurité de la scène (0–1).
 * @returns {boolean}
 */
export function isDaylight({ active, bright, darkness = {} }, darknessLevel) {
  const { min = 0, max = 1 } = darkness;
  return Boolean(active) && (bright > 0) && (darknessLevel >= min) && (darknessLevel <= max);
}
