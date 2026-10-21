/**
 * Plan Éthéré — la vue depuis l'Éthéré, locale à chaque client, purement visuelle (rien n'est écrit). Quand l'un des tokens d'où ce
 * client regarde porte l'état `ethereal` de dnd5e :
 *  - **le plan matériel** (`canvas.environment` : scène + éclairage, client/config.mjs:678-690, comme le flou de la vision dans le noir)
 *    passe dans un filtre d'une seule passe : flou doux (12 échantillons), gris, brume bleutée ;
 *  - **les créatures Éthérées** visibles sont redessinées par-dessus, hors du filtre : une copie nette de leur image, dans leurs
 *    couleurs, et un halo bleuté (un disque dégradé teinté, sans filtre) — l'image d'origine reste floue dessous. Ces deux images sont
 *    des enfants du token lui-même (dans `canvas.interface`), juste après son `voidMesh` : ce masque efface tout ce que l'interface a
 *    dessiné avant lui sous le token (interface.mjs:75, « Token#voidMesh erase non-interface elements ») — une copie posée dans un
 *    conteneur à part de l'interface était effacée (vu le 2026-10-21 : la copie existait, l'image finale restait grise) ; après lui,
 *    elles restent sous les barres, les effets et le nom.
 * Les règles sont celles du moteur de combat (couplage facultatif) : sans lui, l'état seul décide. Avec lui, il cède sa propre vue grise
 * (hook `dnd5e-combat.etherealView`, réponse false) quand cette vue est activée.
 */

import { ETHEREAL_DEFAULTS, clamp01, haloSize, rgbOf } from "../core/ethereal.mjs";
import { setting } from "../settings.mjs";

// `highp` : même raison que le flou de la vision dans le noir (précisions des uniformes du vertex par défaut de PIXI).
const FRAGMENT = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 filterClamp;
uniform float uBlur;
uniform float uMist;
uniform vec3 uTint;

vec4 tap(vec2 offset) {
  return texture2D(uSampler, clamp(vTextureCoord + offset, filterClamp.xy, filterClamp.zw));
}

void main() {
  vec4 color = texture2D(uSampler, vTextureCoord);
  vec4 sum = color * 2.0;
  if ( uBlur > 0.0 ) {
    vec2 px = inputSize.zw * uBlur;
    sum += tap(px * vec2( 0.5,  0.0)) + tap(px * vec2(-0.5,  0.0));
    sum += tap(px * vec2( 0.0,  0.5)) + tap(px * vec2( 0.0, -0.5));
    sum += tap(px * vec2( 0.35,  0.35)) + tap(px * vec2(-0.35,  0.35));
    sum += tap(px * vec2( 0.35, -0.35)) + tap(px * vec2(-0.35, -0.35));
    sum += tap(px * vec2( 1.0,  0.0)) + tap(px * vec2(-1.0,  0.0));
    sum += tap(px * vec2( 0.0,  1.0)) + tap(px * vec2( 0.0, -1.0));
    color = sum / 14.0;
  }
  float a = max(color.a, 1e-4);
  vec3 rgb = color.rgb / a;
  float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  vec3 gray = vec3(luma) * mix(vec3(1.0), uTint, 0.6);
  vec3 misty = mix(gray, uTint, uMist * (1.0 - (luma * 0.5)));
  gl_FragColor = vec4(misty * a, color.a);
}`;

let filter = null;
let haloTexture = null;
let active = false;
let tickerAdded = false;
/** token → { halo, copy } */
const drawn = new Map();

const isEthereal = token => token?.document?.actor?.statuses?.has?.("ethereal") === true;

/** Les tokens d'où ce client regarde : ceux qu'il contrôle, sinon (joueur) ceux qu'il possède. */
function viewers() {
  const controlled = canvas.tokens?.controlled ?? [];
  if ( controlled.length || game.user.isGM ) return controlled;
  return (canvas.tokens?.placeables ?? []).filter(t => t.isOwner);
}

/** Le moteur de combat a-t-il coupé le plan Éthéré (son interrupteur du MJ) ? Sans lui, l'état seul décide. */
function engineSwitchedOff() {
  const engine = game.modules.get("dnd5e-combat");
  try { return !!(engine?.active && (engine.api?.ethereal?.enabled?.() === false)); }
  catch { return false; }
}

/** La vue depuis l'Éthéré est-elle due sur ce client ? */
export function etherealViewActive() {
  return !!canvas?.ready && (setting("etherealView") !== false) && !engineSwitchedOff() && viewers().some(isEthereal);
}

export function registerEtherealView() {
  Hooks.on("canvasReady", () => refresh());
  Hooks.on("canvasTearDown", () => detach(true));
  Hooks.on("controlToken", () => refresh());
  for ( const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"] ) {
    // Au tour suivant : l'acteur synthétique d'un token non lié n'a ses nouveaux statuts qu'après le hook.
    Hooks.on(hook, effect => { if ( effect?.statuses?.has?.("ethereal") ) setTimeout(refresh, 0); });
  }
  Hooks.on("destroyToken", token => dropToken(token));
  // L'interrupteur du plan Éthéré du moteur basculé.
  Hooks.on("dnd5e-combat.etherealPlane", () => refresh());
  // Le moteur de combat cède sa vue grise à celle-ci (couplage facultatif : sans le moteur, ce hook n'est jamais appelé).
  Hooks.on("dnd5e-combat.etherealView", () => ((setting("etherealView") !== false) ? false : undefined));
}

/** Un réglage, une scène, un état ou un token contrôlé a changé. */
export function refresh() {
  if ( !canvas?.ready ) return;
  active = etherealViewActive();
  if ( !active ) return detach();
  attach();
  if ( !tickerAdded ) {
    canvas.app.ticker.add(tick);
    tickerAdded = true;
  }
}

function attach() {
  const group = canvas.environment;
  if ( !group ) return;
  filter ??= new PIXI.Filter(undefined, FRAGMENT, { uBlur: 0, uMist: 0, uTint: new Float32Array(3) });
  filter.uniforms.uBlur = Math.max(0, Number(setting("etherealBlur")) || 0);
  filter.uniforms.uMist = clamp01(setting("etherealMist"), ETHEREAL_DEFAULTS.mist);
  filter.uniforms.uTint = new Float32Array(rgbOf(ETHEREAL_DEFAULTS.tint));
  filter.enabled = true;
  group.filters ??= [];
  if ( !group.filters.includes(filter) ) group.filters = [...group.filters, filter];
  group.filterArea = canvas.app.renderer.screen;
}

function detach(tearDown=false) {
  active = false;
  if ( tickerAdded && canvas.app ) {
    canvas.app.ticker.remove(tick);
    tickerAdded = false;
  }
  const group = canvas.environment;
  if ( filter && group?.filters?.includes(filter) ) {
    group.filters = group.filters.filter(f => f !== filter);
    // La zone d'écran posée pour nous : la garder si un autre filtre (flou de la vision dans le noir) est encore là.
    if ( !group.filters.length ) {
      group.filters = null;
      group.filterArea = null;
    }
  }
  for ( const token of [...drawn.keys()] ) dropToken(token);
  if ( tearDown ) drawn.clear();
}

function dropToken(token) {
  const d = drawn.get(token);
  if ( !d ) return;
  if ( !d.halo.destroyed ) d.halo.destroy();
  if ( !d.copy.destroyed ) d.copy.destroy();
  drawn.delete(token);
}

/** Un disque blanc dégradé, teinté à l'usage : le halo, sans filtre. */
function halo() {
  if ( haloTexture && !haloTexture.destroyed ) return haloTexture;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  haloTexture = PIXI.Texture.from(c);
  return haloTexture;
}

/** Le halo et la copie d'un token, dans le token juste après son `voidMesh` (recréés si le token a été redessiné). */
function spritesOf(token, mesh) {
  let d = drawn.get(token);
  if ( d && !d.copy.destroyed && !d.halo.destroyed && (d.copy.parent === token) ) return d;
  if ( d ) dropToken(token);
  d = { halo: new PIXI.Sprite(halo()), copy: new PIXI.Sprite(mesh.texture) };
  d.halo.anchor.set(0.5);
  d.halo.eventMode = d.copy.eventMode = "none";
  const at = token.voidMesh ? token.getChildIndex(token.voidMesh) + 1 : 0;
  token.addChildAt(d.copy, at);
  token.addChildAt(d.halo, at);
  drawn.set(token, d);
  return d;
}

/**
 * À chaque image tant que la vue est due : les copies suivent l'image animée du token. Le token est un conteneur placé en (x, y) de la
 * scène ; son image (`mesh`, dans le groupe primaire) est en coordonnées de scène : on la ramène au repère du token.
 */
function tick() {
  if ( !active ) return;
  const haloAlpha = clamp01(setting("etherealHalo"), ETHEREAL_DEFAULTS.halo);
  const haloTint = new PIXI.Color(setting("etherealHaloColor") || ETHEREAL_DEFAULTS.haloColor).toNumber();
  const wanted = new Set();
  for ( const token of canvas.tokens.placeables ) {
    const mesh = token.mesh;
    if ( !isEthereal(token) || token.destroyed || !mesh?.texture || mesh.destroyed ) continue;
    wanted.add(token);
    const d = spritesOf(token, mesh);
    if ( d.copy.texture !== mesh.texture ) d.copy.texture = mesh.texture;
    const local = { x: mesh.position.x - token.position.x, y: mesh.position.y - token.position.y };
    d.copy.anchor.copyFrom(mesh.anchor);
    d.copy.position.set(local.x, local.y);
    d.copy.scale.copyFrom(mesh.scale);
    d.copy.rotation = mesh.rotation;
    d.copy.tint = mesh.tint ?? 0xffffff;
    d.copy.visible = mesh.visible;
    d.halo.visible = mesh.visible && (haloAlpha > 0);
    d.halo.alpha = haloAlpha;
    d.halo.tint = haloTint;
    d.halo.width = d.halo.height = haloSize(mesh.width, mesh.height);
    d.halo.position.set(local.x, local.y);
  }
  for ( const token of [...drawn.keys()] ) if ( !wanted.has(token) ) dropToken(token);
}
