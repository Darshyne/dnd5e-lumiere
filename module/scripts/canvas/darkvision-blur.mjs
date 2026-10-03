/**
 * Vision dans le noir — flou au-delà de la portée. Local à chaque client, purement visuel : ni la portée de
 * vue, ni les modes de vision ou de détection ne sont touchés, si bien que la vision simulée du moteur de
 * combat (qui rejoue les sources du cœur) n'en voit rien.
 *
 * Le gris « net » à portée est celui du mode de vision `darkvision` du cœur (client/config.mjs:1160-1177),
 * que dnd5e 6 donne aux tokens dont la fiche a la vision dans le noir (senseVisionSync,
 * documents/token.mjs:74-131). Ici on n'ajoute que le flou.
 *
 * - Un **masque** en coordonnées de scène, à résolution réduite : blanc = net (disque `token.sightRange`
 *   (placeables/token.mjs:783) de chaque token d'où l'on regarde qui a la vision dans le noir, et zones de
 *   lumière vive : polygone de chaque source découpé à son rayon vif par `intersectCircle`,
 *   extensions/polygon-extension.mjs:231), bords fondus. Redessiné seulement quand il est marqué sale.
 * - Un **filtre** sur `canvas.environment` (scène + éclairage, client/config.mjs:678-690 — ni le brouillard
 *   ni l'interface : barres et noms restent nets) qui mélange l'image et sa version floue selon le masque.
 * - Désactivé sans token d'où regarder qui ait la vision dans le noir (le MJ qui ne contrôle rien voit
 *   tout), et quand une lumière globale vive éclaire la scène (tout est en lumière vive).
 */

import { grantsDarkvision, isDaylight, maskScale, screenToMaskMatrix } from "../core/darkvision.mjs";
import { setting } from "../settings.mjs";

// `highp` obligatoire : le vertex par défaut des filtres PIXI déclare `inputSize` / `outputFrame` en highp, et
// des précisions différentes empêchent l'édition de liens du programme (« Precisions of uniform 'inputSize'
// differ… », vu le 2026-09-26) — le filtre ne rendait alors rien du tout, scène vide.
const FRAGMENT = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uMask;
uniform mat3 uScreenToMask;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform vec4 filterClamp;
uniform float uStrength;

vec4 tap(vec2 offset) {
  return texture2D(uSampler, clamp(vTextureCoord + offset, filterClamp.xy, filterClamp.zw));
}

void main() {
  vec4 color = texture2D(uSampler, vTextureCoord);
  vec2 screen = vTextureCoord * inputSize.xy + outputFrame.xy;
  vec2 muv = (uScreenToMask * vec3(screen, 1.0)).xy;
  bool inside = all(greaterThanEqual(muv, vec2(0.0))) && all(lessThanEqual(muv, vec2(1.0)));
  float sharp = inside ? texture2D(uMask, muv).r : 0.0;
  if ( (sharp > 0.995) || (uStrength <= 0.0) ) {
    gl_FragColor = color;
    return;
  }
  // Disque de 12 échantillons sur deux anneaux : un flou doux, en une seule passe.
  vec2 px = inputSize.zw * uStrength;
  vec4 sum = color * 2.0;
  sum += tap(px * vec2( 0.5,  0.0)) + tap(px * vec2(-0.5,  0.0));
  sum += tap(px * vec2( 0.0,  0.5)) + tap(px * vec2( 0.0, -0.5));
  sum += tap(px * vec2( 0.35,  0.35)) + tap(px * vec2(-0.35,  0.35));
  sum += tap(px * vec2( 0.35, -0.35)) + tap(px * vec2(-0.35, -0.35));
  sum += tap(px * vec2( 1.0,  0.0)) + tap(px * vec2(-1.0,  0.0));
  sum += tap(px * vec2( 0.0,  1.0)) + tap(px * vec2( 0.0, -1.0));
  vec4 blurred = sum / 14.0;
  gl_FragColor = mix(blurred, color, sharp);
}`;

let filter = null;
let maskTexture = null;
let dirty = true;
let tickerAdded = false;

export function registerDarkvisionBlur() {
  Hooks.on("canvasReady", () => markDirty());
  Hooks.on("canvasTearDown", () => detach());
  Hooks.on("lightingRefresh", () => markDirty());
  Hooks.on("sightRefresh", () => markDirty());
  Hooks.on("controlToken", () => markDirty());
  Hooks.on("refreshToken", (token, flags) => {
    if ( (flags.refreshPosition || flags.refreshSize) && isViewer(token) ) markDirty();
  });
  Hooks.on("updateToken", (doc, changes) => {
    if ( ("sight" in changes) || ("detectionModes" in changes) ) markDirty();
  });
}

/** Réglage modifié, ou état du monde changé. */
export function markDirty() {
  dirty = true;
  if ( tickerAdded || !canvas.app ) return;
  canvas.app.ticker.add(tick);
  tickerAdded = true;
}

function tick() {
  if ( !canvas.ready ) return;
  if ( dirty ) {
    dirty = false;
    rebuild();
  }
  if ( filter?.enabled ) updateMatrix();
}

/** Les tokens d'où ce client regarde : ceux qu'il contrôle, sinon (joueur) ceux qu'il possède et qui voient. */
function viewers() {
  const controlled = canvas.tokens.controlled.filter(t => t.hasSight);
  if ( controlled.length || game.user.isGM ) return controlled;
  return canvas.tokens.placeables.filter(t => t.isOwner && t.hasSight);
}

function isViewer(token) {
  return token.controlled || (!game.user.isGM && token.isOwner);
}

function darkvisionViewers() {
  return viewers().filter(t => grantsDarkvision({
    visionMode: t.document.sight.visionMode, range: t.document.sight.range, hasSight: t.hasSight
  }));
}

/**
 * Plein jour : la scène entière est en lumière vive, le flou n'a pas lieu d'être.
 * - Avec le moteur de combat (`dnd5e-combat` ≥ 0.146.0, couplage **facultatif**, sans dépendance — SPEC §9, 0.9.0) : ce
 *   que ses règles disent de la lumière globale (`api.ui.globalLight()`), crépuscule compris — une lumière globale vive
 *   qu'il compte comme faible au-delà de son seuil d'obscurité laisse le flou, comme elle impose le Désavantage.
 * - Sans lui : core/darkvision.mjs, `isDaylight` — lumière globale **vive** et obscurité dans sa plage. Une lumière
 *   globale faible (vu le 2026-09-26 sur Restored Keep : elle coupait le flou) ou hors de sa plage laisse le flou.
 * Un changement d'obscurité rafraîchit l'éclairage (groups/environment.mjs:194), d'où un nouveau passage ici.
 */
function daylight() {
  const engine = game.modules.get("dnd5e-combat");
  const ruled = (engine?.active && engine.api?.active) ? engine.api.ui?.globalLight : null;
  if ( typeof ruled === "function" ) {
    try { return ruled() === "bright"; }
    catch { /* le moteur a échoué : notre propre lecture */ }
  }
  const global = canvas.environment?.globalLightSource;
  return !!global && isDaylight({ active: global.active, bright: global.data.bright, darkness: global.data.darkness },
    canvas.environment.darknessLevel);
}

function rebuild() {
  const lookers = setting("darkvisionBlur") ? darkvisionViewers() : [];
  if ( !lookers.length || daylight() || !(setting("darkvisionBlurStrength") > 0) ) return detach();
  renderMask(lookers);
  attach();
  filter.uniforms.uStrength = setting("darkvisionBlurStrength");
  updateMatrix();
}

function renderMask(lookers) {
  const { width, height } = canvas.dimensions;
  const s = maskScale(width, height);
  const w = Math.max(1, Math.ceil(width * s));
  const h = Math.max(1, Math.ceil(height * s));
  if ( !maskTexture || maskTexture.destroyed || (maskTexture.width !== w) || (maskTexture.height !== h) ) {
    maskTexture?.destroy(true);
    maskTexture = PIXI.RenderTexture.create({ width: w, height: h });
  }

  const g = new PIXI.Graphics();
  g.beginFill(0x000000).drawRect(0, 0, width, height).endFill();
  g.beginFill(0xffffff);
  for ( const token of lookers ) {
    const { x, y } = token.center;
    g.drawCircle(x, y, token.sightRange);
  }
  const { GlobalLightSource } = foundry.canvas.sources;
  for ( const source of canvas.effects.lightSources ) {
    if ( (source instanceof GlobalLightSource) || !source.active || !source.shape ) continue;
    const bright = source.data.bright;
    if ( !(bright > 0) ) continue;
    const zone = source.shape.intersectCircle(new PIXI.Circle(source.data.x, source.data.y, bright));
    if ( zone?.points?.length >= 6 ) g.drawShape(zone);
  }
  g.endFill();

  const container = new PIXI.Container();
  container.addChild(g);
  container.scale.set(s);
  // Bords fondus : une demi-case de transition entre net et flou.
  const feather = new PIXI.BlurFilter(Math.max(1, canvas.dimensions.size * 0.5 * s), 2);
  container.filters = [feather];
  canvas.app.renderer.render(container, { renderTexture: maskTexture, clear: true });
  container.destroy({ children: true });
  feather.destroy();
}

function attach() {
  const group = canvas.environment;
  if ( !group ) return;
  filter ??= new PIXI.Filter(undefined, FRAGMENT, {
    uMask: PIXI.Texture.EMPTY, uScreenToMask: new Float32Array(9), uStrength: 0
  });
  filter.uniforms.uMask = maskTexture;
  filter.enabled = true;
  group.filters ??= [];
  if ( !group.filters.includes(filter) ) group.filters = [...group.filters, filter];
  // Sans zone de filtre, PIXI mesurerait les bornes de tout le groupe à chaque image.
  group.filterArea = canvas.app.renderer.screen;
}

function detach() {
  if ( !filter ) return;
  filter.enabled = false;
  const group = canvas.environment;
  if ( group?.filters?.includes(filter) ) {
    group.filters = group.filters.filter(f => f !== filter);
    if ( !group.filters.length ) {
      group.filters = null;
      group.filterArea = null;
    }
  }
}

function updateMatrix() {
  const m = screenToMaskMatrix(canvas.stage.worldTransform, canvas.dimensions.width, canvas.dimensions.height);
  if ( m ) filter.uniforms.uScreenToMask = m;
}
