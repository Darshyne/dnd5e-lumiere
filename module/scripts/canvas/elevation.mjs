/**
 * Lectures d'élévation partagées : sol du level d'un token, référence de celui qui regarde.
 *
 * Sol = bas du level du token (`Level#elevation.bottom`, common/documents/level.mjs:79 ; `null` veut dire
 * −∞, on retombe alors sur 0). On lit l'élévation *affichée* (`document.elevation`, animée), pas
 * `_source` : la perspective suit le token pendant qu'il monte.
 */

export function groundOf(doc) {
  const bottom = doc.parent?.levels?.get(doc.level)?.elevation?.bottom;
  return Number.isFinite(bottom) ? bottom : 0;
}

/** Élévation au-dessus du sol de son level, en unités de scène. */
export function heightAboveGround(token) {
  return token.document.elevation - groundOf(token.document);
}

/**
 * Le token depuis lequel ce client regarde : le premier token contrôlé, sinon un token du personnage
 * assigné sur la scène, sinon aucun (le MJ regarde depuis le sol).
 * @returns {Token|null}
 */
export function referenceToken() {
  const controlled = canvas.tokens.controlled[0];
  if ( controlled ) return controlled;
  return game.user.character?.getActiveTokens()?.[0] ?? null;
}

/** Élévation de référence de ce client, en unités de scène. */
export function referenceElevation() {
  const ref = referenceToken();
  if ( ref ) return ref.document.elevation;
  const bottom = canvas.level?.elevation?.bottom;
  return Number.isFinite(bottom) ? bottom : 0;
}
