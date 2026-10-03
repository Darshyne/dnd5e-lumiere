/**
 * Étape 1 — ombre de contact sous chaque token.
 *
 * L'ombre est un PrimarySpriteMesh du groupe primaire (là où vit `token.mesh`, token.mjs:1233),
 * à l'élévation du token et au sortLayer juste sous celui des tokens (primary.mjs:45, 485) :
 * au-dessus des tuiles de même élévation, sous tous les tokens, recouverte par une tuile plus haute,
 * éclairée comme le reste de la scène. Elle est resynchronisée dans `refreshToken`, qui passe après
 * tous les rafraîchissements du cœur (placeable-object.mjs:439-440) — visibilité et alpha du mesh
 * compris (token.mjs:1422, 1448). Les hooks sont posés par le point d'entrée.
 */

import { contactShadowGeometry } from "../core/contact-shadow.mjs";
import { shadowResponse } from "../core/hover.mjs";
import { MODULE_ID, setting } from "../settings.mjs";
import { shadowTexture } from "./shadow-texture.mjs";
import { groundOf } from "./elevation.mjs";
import { visualState } from "./state.mjs";

const SORT_LAYER = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS - 1;

/** @type {WeakMap<Token, PrimarySpriteMesh>} */
const shadows = new WeakMap();

/** À drawToken / refreshToken, et à chaque frame pour un token qui flotte. */
export function syncContactShadow(token) {
  const mesh = token.mesh;
  if ( !mesh || mesh.destroyed ) return removeContactShadow(token);
  if ( !setting("contactShadow") ) return removeContactShadow(token);

  let shadow = shadows.get(token);
  if ( !shadow || shadow.destroyed ) {
    const { PrimarySpriteMesh } = foundry.canvas.primary;
    shadow = canvas.primary.addChild(new PrimarySpriteMesh({
      name: `${MODULE_ID}.contact.${token.objectId}`,
      texture: shadowTexture()
    }));
    shadow.anchor.set(0.5, 0.5);
    shadow.eventMode = "none";
    shadows.set(token, shadow);
  }

  const { width, height } = token.document.getSize();
  const geom = contactShadowGeometry({ width, height }, {
    size: setting("contactSize"),
    opacity: setting("contactOpacity")
  });

  // token.center suit la position animée (document.x/y), pas `_source` : l'ombre glisse avec le token.
  const { x, y } = token.center;
  // Token qui flotte : l'ombre reste au sol, rétrécit et pâlit avec la hauteur (étape 2).
  const lift = shadowResponse(visualState(token).height);
  shadow.position.set(x, y + geom.offsetY);
  shadow.width = geom.width * lift.scale;
  shadow.height = geom.height * lift.scale;
  // Au sol du level : un token en vol au-dessus d'un pont a son ombre sous le pont.
  shadow.elevation = groundOf(token.document);
  shadow.sortLayer = SORT_LAYER;
  shadow.sort = mesh.sort;
  // Même formule que le cœur pour le mesh (token.mjs:1448) : alpha du document et voile MJ d'un token
  // caché — mais pas la transparence de perspective, qui estompe le token, pas son ombre.
  shadow.alpha = geom.alpha * lift.alpha * token.alpha * token.document.alpha;
  shadow.visible = mesh.visible;
}

export function removeContactShadow(token) {
  const shadow = shadows.get(token);
  if ( !shadow ) return;
  shadows.delete(token);
  if ( !shadow.destroyed ) shadow.destroy();
}
