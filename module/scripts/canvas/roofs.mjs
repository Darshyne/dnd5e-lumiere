/**
 * Toits toujours visibles — local à chaque client, purement visuel (rien n'est écrit hors du flag de la tuile, posé par le MJ).
 *
 * Le brouillard est un filtre du groupe `canvas.visibility` (groups/visibility.mjs:331) : il laisse voir le groupe primaire là où la
 * texture du masque de vision (`canvas.masks.vision.renderTexture`, canal rouge) vaut 1, et noircit ou assombrit ailleurs
 * (rendering/filters/visibility.mjs, `mix(fow, vec4(0.0), v)`). L'éclairage hors de la vue est remplacé par la couleur du niveau
 * d'obscurité selon cette même texture (rendering/filters/effects-masking.mjs, `enableVisionMasking`).
 *
 * Une tuile marquée ajoute donc sa silhouette (sa propre image, fondue en MAX_COLOR comme les polygones de vision) au
 * conteneur du masque, **avant** le conteneur `vision` du cœur : ses ténèbres magiques (`vision.darkness`, ERASE) l'effacent encore.
 * Le cœur dessine ensuite la vraie tuile comme vue : son éclairage, sa météo, son occlusion et ses restrictions (lumière, météo) sont
 * les siens. Ce qui n'est pas touché :
 *  - le brouillard exploré, enregistré par le cœur, ne lit que `canvas.visibility.vision` (perception/fog.mjs:425), pas ce conteneur ;
 *  - la visibilité des tokens, des portes, la vision des règles (moteur de combat) se calculent sur les polygones, pas sur la texture.
 * Le fondu au survol de la souris est coupé sur une tuile marquée (`mesh.hoverFade`, que le cœur repose à chaque `_refreshMesh`,
 * placeables/tile.mjs:365 — d'où sa remise à faux à chaque image) : le toit reste affiché, il ne s'efface que quand un token passe
 * dessous (demande de l'utilisateur, 2026-10-21). Rendu à la tuile démarquée par un `refreshMesh`.
 * Quand un token est sous le toit (occulté), que la souris l'estompe malgré tout, ou qu'une surface occultée de V14 le touche (plafond de niveau
 * survolé : `canvas.masks.occlusion.occludedSurfaces`, layers/masks/occlusion.mjs:69, 298-302), la silhouette s'efface : l'intérieur
 * n'est jamais révélé à travers le brouillard.
 */

import { isMarkedRoof, roofMaskAlpha, roofSignature, touchesOccludedSurface } from "../core/roofs.mjs";
import { MODULE_ID } from "../settings.mjs";

// Le masque ne lit que le canal rouge : un sprite y écrirait les couleurs de l'image (un toit brun ≈ 0,3, donc encore 70 % de
// brouillard, vu le 2026-10-21 sur une carte de l'utilisateur). Ce filtre, sur le conteneur des silhouettes, n'en garde que l'opacité,
// en blanc : 1 partout où le toit est opaque, fondu au survol compris (l'alpha prémultiplié inclut celui du sprite).
const SILHOUETTE = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
void main() {
  gl_FragColor = vec4(texture2D(uSampler, vTextureCoord).a);
}`;

let container = null;
let silhouette = null;
let tickerAdded = false;
/** tuile → { sprite, signature } */
const drawn = new Map();

const marked = tile => isMarkedRoof(tile?.document?.flags?.[MODULE_ID]);

export function registerRoofs() {
  Hooks.on("canvasReady", () => refresh());
  Hooks.on("canvasTearDown", () => detach());
  Hooks.on("drawTile", () => refresh());
  Hooks.on("destroyTile", tile => { dropTile(tile); refresh(); });
  Hooks.on("updateTile", (doc, changes) => {
    if ( foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) ) refresh();
  });
}

/** Une tuile a été dessinée, marquée ou démarquée, ou la scène a changé. */
export function refresh() {
  if ( !canvas?.ready ) return;
  const any = canvas.tiles?.placeables?.some(marked);
  if ( !any ) return detach();
  if ( !tickerAdded ) {
    canvas.app.ticker.add(tick);
    tickerAdded = true;
  }
  tick();
}

function detach() {
  if ( tickerAdded && canvas.app ) {
    canvas.app.ticker.remove(tick);
    tickerAdded = false;
  }
  for ( const tile of [...drawn.keys()] ) dropTile(tile);
  if ( container && !container.destroyed ) container.destroy();
  container = null;
  if ( canvas?.masks?.vision ) canvas.masks.vision.renderDirty = true;
}

function dropTile(tile) {
  const d = drawn.get(tile);
  if ( !d ) return;
  if ( !d.sprite.destroyed ) d.sprite.destroy();
  drawn.delete(tile);
  // Le cœur recalcule son fondu au survol.
  if ( !tile.destroyed && tile.mesh && !tile.mesh.destroyed ) tile.renderFlags.set({ refreshMesh: true });
  if ( canvas?.masks?.vision ) canvas.masks.vision.renderDirty = true;
}

/** Le conteneur des silhouettes, premier enfant du masque de vision (recréé si le masque a été vidé). */
function holder() {
  const mask = canvas.masks?.vision;
  if ( !mask ) return null;
  if ( container && !container.destroyed && (container.parent === mask) ) return container;
  if ( container && !container.destroyed ) container.destroy({ children: true });
  drawn.clear();
  container = mask.addChildAt(new PIXI.Container(), 0);
  container.eventMode = "none";
  if ( !silhouette ) {
    silhouette = new PIXI.Filter(undefined, SILHOUETTE);
    silhouette.blendMode = PIXI.BLEND_MODES.MAX_COLOR;
  }
  container.filters = [silhouette];
  return container;
}

/**
 * À chaque image tant qu'un toit marqué existe : la silhouette suit l'image de la tuile (position, échelle, rotation, texture) et son
 * occlusion. Le masque n'est redessiné que si l'une d'elles a changé.
 */
function tick() {
  const parent = holder();
  if ( !parent ) return;
  let dirty = false;
  const wanted = new Set();
  const surfaces = [...(canvas.masks.occlusion?.occludedSurfaces ?? [])]
    .map(s => ({ elevation: s.elevation, bounds: s.region?.bounds }));
  for ( const tile of canvas.tiles.placeables ) {
    const mesh = tile.mesh;
    if ( !marked(tile) || tile.destroyed || !mesh || mesh.destroyed || !mesh.texture ) continue;
    wanted.add(tile);
    if ( mesh.hoverFade ) mesh.hoverFade = false;
    let d = drawn.get(tile);
    if ( !d || d.sprite.destroyed ) {
      const sprite = new PIXI.Sprite(mesh.texture);
      sprite.eventMode = "none";
      parent.addChild(sprite);
      d = { sprite, signature: "" };
      drawn.set(tile, d);
    }
    const alpha = roofMaskAlpha({
      visible: mesh.visible && !!tile.visible,
      occluded: mesh.occluded,
      surfaceOccluded: touchesOccludedSurface(surfaces, { elevation: mesh.elevation, bounds: tile.bounds }),
      hoverOcclusion: mesh._hoverFadeState?.occlusion ?? 0
    });
    const signature = roofSignature({
      texture: mesh.texture.baseTexture?.uid ?? "", x: mesh.position.x, y: mesh.position.y, scaleX: mesh.scale.x,
      scaleY: mesh.scale.y, anchorX: mesh.anchor.x, anchorY: mesh.anchor.y, rotation: mesh.rotation, alpha
    });
    if ( signature === d.signature ) continue;
    const s = d.sprite;
    if ( s.texture !== mesh.texture ) s.texture = mesh.texture;
    s.anchor.copyFrom(mesh.anchor);
    s.position.copyFrom(mesh.position);
    s.scale.copyFrom(mesh.scale);
    s.rotation = mesh.rotation;
    s.alpha = alpha;
    s.visible = alpha > 0;
    d.signature = signature;
    dirty = true;
  }
  for ( const tile of [...drawn.keys()] ) if ( !wanted.has(tile) ) {
    dropTile(tile);
    dirty = true;
  }
  if ( dirty ) canvas.masks.vision.renderDirty = true;
}
