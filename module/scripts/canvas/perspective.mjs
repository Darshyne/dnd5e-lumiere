/**
 * Étape 3 — échelle relative à celui qui regarde, et transparence d'un token haut qui en recouvre un
 * plus bas. Local à chaque client : deux joueurs voient deux perspectives différentes.
 *
 * Échelle : le cœur ne réécrit `mesh.scale` que par `mesh.resize`, dans `_refreshMeshSizeAndScale`
 * (token.mjs:1459-1478), appelé pour `refreshSize` et `refreshMesh` (token.mjs:1390, 1392). On relève
 * donc l'échelle de base à ces moments-là et on la multiplie ; hors de ces moments, la base relevée reste
 * juste. Opacité : le cœur pose `mesh.alpha` (token.mjs:1495, 1562) et d'autres modules aussi (Monk's
 * Bloodsplats rend un mort translucide). On ne la réécrit donc plus : on l'estompe seulement, à partir de
 * l'opacité trouvée, et on rend celle-ci quand l'estompage s'arrête (`fadedAlpha`).
 */

import { fadedAlpha, overlaps, perspectiveScale } from "../core/perspective.mjs";
import { setting } from "../settings.mjs";
import { referenceElevation } from "./elevation.mjs";
import { facingScale } from "./facing.mjs";
import { tokenDisplaySize } from "./token-size.mjs";
import { visualState } from "./state.mjs";

/** Tokens plus hauts que la référence : ce sont les seuls qui peuvent s'estomper. */
const elevated = new Set();

/**
 * @param {Token} token
 * @param {object} [flags]   Drapeaux de rendu du `refreshToken` en cours, s'il y en a un.
 */
export function syncPerspective(token, flags) {
  const mesh = token.mesh;
  if ( token.destroyed || !mesh || mesh.destroyed ) return;
  const state = visualState(token);

  // Base d'échelle : fraîche si le cœur vient de redimensionner, sinon celle d'avant nos facteurs. Le premier relevé se fait
  // avant tout facteur posé par ce module (rien n'est encore appliqué) ; ensuite seuls `refreshSize` / `refreshMesh` la
  // renouvellent, sans division (le miroir passe par 0 pendant un demi-tour).
  if ( !state.baseScale || flags?.refreshSize || flags?.refreshMesh ) {
    state.baseScale = { x: mesh.scale.x, y: mesh.scale.y };
  }
  // Retournement gauche / droite (issue #4) : un facteur horizontal de plus, miroir du token et plafond compris dans la base.
  const mirror = facingScale(token);

  if ( !setting("perspective") ) {
    mesh.scale.set(state.baseScale.x * mirror, state.baseScale.y);
    applyFade(mesh, state, false);
    elevated.delete(token);
    return;
  }

  const delta = token.document.elevation - referenceElevation();
  const f = perspectiveScale(delta, canvas.grid.distance, { maxScale: setting("perspectiveMax") });
  mesh.scale.set(state.baseScale.x * f * mirror, state.baseScale.y * f);

  if ( delta > 0 ) elevated.add(token);
  else elevated.delete(token);
  const fade = (delta > 0) && !token.controlled && !token.hover && coversLowerToken(token);
  applyFade(mesh, state, fade);
}

/**
 * Pose ou retire l'estompage sans écraser l'opacité du cœur ou d'un autre module (Monk's Bloodsplats) :
 * hors estompage, on ne touche pas à `mesh.alpha`.
 */
function applyFade(mesh, state, fade) {
  const { alpha, memo } = fadedAlpha(mesh.alpha, state.fade ?? null, fade, setting("fadeAlpha"));
  if ( alpha !== null ) mesh.alpha = alpha;
  state.fade = memo;
}

/** Un token a bougé : ceux qui sont en hauteur peuvent maintenant le recouvrir, ou plus. */
export function syncElevatedAround(moved) {
  for ( const token of elevated ) {
    if ( token === moved ) continue;
    if ( token.destroyed ) elevated.delete(token);
    else syncPerspective(token);
  }
}

export function removePerspective(token) {
  elevated.delete(token);
}

/**
 * Même niveau seulement : un token d'un niveau inférieur reste `mesh.visible` sous le plancher d'un niveau
 * affiché au-dessus (une surface sans `culling` ne le masque pas, token.mjs:633 ; c'est le fond du niveau,
 * plus haut dans le tri, qui le recouvre). Vu le 2026-09-26 dans Restored Keep (dnd-6), où aucune surface
 * n'a `culling` : sans ce filtre, une créature en vol à l'étage s'estompait au-dessus d'un token caché
 * sous le plancher.
 */
function coversLowerToken(token) {
  const self = disc(token);
  const { elevation, level } = token.document;
  for ( const other of canvas.tokens.placeables ) {
    if ( (other === token) || !other.mesh?.visible || (other.document.level !== level) ) continue;
    if ( other.document.elevation >= elevation ) continue;
    if ( overlaps(self, disc(other)) ) return true;
  }
  return false;
}

function disc(token) {
  const { width, height } = tokenDisplaySize(token);
  const { x, y } = token.center;
  return { x, y, r: Math.min(width, height) / 2 };
}
