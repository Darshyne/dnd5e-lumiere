/**
 * Géométrie de l'ombre de contact : une ellipse douce posée sous le token, un peu décalée vers le
 * bas de l'écran (lumière zénithale légèrement « avant », la convention des jeux vus de dessus).
 * Calcul pur : les dimensions arrivent en pixels, rien n'est lu dans Foundry.
 */

/** Réglages par défaut, surchargés par les réglages du monde. */
export const CONTACT_DEFAULTS = Object.freeze({
  size: 1.25,     // diamètre de l'ombre / largeur affichée du token : elle doit DÉPASSER de l'image,
                  // sinon un token opaque (portrait rond de Tokenizer) la recouvre entièrement
  aspect: 0.95,   // hauteur / largeur de l'ellipse
  offsetY: 0.1,   // décalage vers le bas, en fraction de la hauteur du token
  opacity: 0.8
});

/**
 * @param {object} token
 * @param {number} token.width    Largeur du token en pixels (taille du document).
 * @param {number} token.height   Hauteur du token en pixels.
 * @param {Partial<typeof CONTACT_DEFAULTS>} [options]
 * @returns {{width: number, height: number, offsetY: number, alpha: number}}
 */
export function contactShadowGeometry({ width, height }, options = {}) {
  const { size, aspect, offsetY, opacity } = { ...CONTACT_DEFAULTS, ...options };
  // L'ombre suit la taille du token (ses cases), jamais l'échelle de son image : une illustration à
  // l'échelle 2 dont des parties débordent de la case aurait sinon une ombre énorme (vu en jeu le
  // 2026-09-26). Un token non carré ne donne pas une ombre en cigare : on part du plus petit côté.
  const footprint = Math.min(width, height);
  const w = footprint * size;
  return {
    width: w,
    height: w * aspect,
    offsetY: height * offsetY,
    alpha: clamp(opacity, 0, 1)
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
