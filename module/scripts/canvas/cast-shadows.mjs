/**
 * Étape 4 — ombres portées par les lumières de la scène, deux au plus par token.
 *
 * Sources : `canvas.effects.lightSources` (client/canvas/groups/effects.mjs:55), sans la lumière globale ni
 * la lumière que porte le token lui-même. Rayons `data.bright` / `data.dim` en pixels (placeables/light.mjs:
 * 109-121), élévation `data.elevation` en unités de scène. Une lumière n'éclaire le token que si
 * `testPoint` le dit (sources/base-effect-source.mjs:365 : forme de la lumière, donc murs, et surfaces V14) —
 * c'est le test d'occlusion gratuit : pas d'ombre portée par une torche de l'autre côté d'un mur.
 *
 * Mêmes principes que l'ombre de contact : meshes du groupe primaire, au sol du level, juste sous elle
 * (sortLayer TOKENS − 2), texture partagée ; recalcul sur événement (refreshToken, lightingRefresh), jamais
 * à chaque frame — le flottement ne les fait pas osciller.
 *
 * Le soleil (canvas/sun.mjs) entre en concurrence avec les lumières, avec sa force pour éclairement : il
 * compte dans les deux ombres au plus.
 *
 * Vacillement : la géométrie reste calculée sur événement ; seules les ombres d'une lumière animée sont
 * reprises à chaque image, à partir de leur géométrie de base, d'après le `brightnessPulse` que le cœur vient
 * de poser sur la couche d'illumination de la source (sources/base-light-source.mjs:269-290). Un seul ticker,
 * qui ne parcourt que ces ombres-là.
 */

import {
  CAST_DEFAULTS, castShadowGeometry, directionalShadowGeometry, flicker, lightIntensity, pickLights
} from "../core/cast-shadow.mjs";
import { sunRayEnd } from "../core/sun.mjs";
import { MODULE_ID, setting } from "../settings.mjs";
import { groundOf, heightAboveGround } from "./elevation.mjs";
import { shadowTexture } from "./shadow-texture.mjs";
import { currentSun } from "./sun.mjs";

const SORT_LAYER = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS - 2;

/** @type {WeakMap<Token, PrimarySpriteMesh[]>} */
const pools = new WeakMap();

/**
 * Ombres d'une lumière animée, avec leur géométrie de base (avant vacillement).
 * @type {Map<PrimarySpriteMesh, {source: object, x: number, y: number, length: number, rotation: number, alpha: number}>}
 */
const flickering = new Map();
let tickerAdded = false;

export function syncCastShadows(token) {
  const mesh = token.mesh;
  if ( token.destroyed || !mesh || mesh.destroyed || !setting("lightShadows") ) return removeCastShadows(token);
  const pool = pools.get(token) ?? [];
  pools.set(token, pool);

  const picks = mesh.visible ? pickLights(candidates(token), CAST_DEFAULTS.maxShadows) : [];
  const grid = { distance: canvas.grid.distance, size: canvas.grid.size };
  const { width, height } = token.document.getSize();
  const ground = groundOf(token.document);
  const { x, y } = token.center;
  const shape = {
    x, y,
    footprint: Math.min(width, height),
    height: (token.document.depth || 1) * grid.distance,
    elevation: heightAboveGround(token)
  };
  const options = { maxLength: setting("castMaxLength") };
  const strength = setting("castIntensity") * token.alpha * token.document.alpha;

  let used = 0;
  for ( const { source, sun, intensity } of picks ) {
    const geom = sun
      ? directionalShadowGeometry({ token: shape, toLight: sun.toSun, altitude: sun.altitude, grid }, options)
      : castShadowGeometry({ token: shape, light: {
        x: source.data.x, y: source.data.y,
        height: Math.max(0, source.data.elevation - ground) + lightHeightOf(source)
      }, grid }, options);
    if ( !geom ) continue;
    const shadow = pool[used] = liveMesh(pool[used], token, used);
    const alpha = Math.min(1, strength * intensity * geom.fade);
    shadow.position.set(geom.x, geom.y);
    shadow.rotation = geom.rotation;
    shadow.width = geom.length;   // axe x de la texture = direction de l'ombre
    shadow.height = geom.width;
    shadow.elevation = ground;
    shadow.sortLayer = SORT_LAYER;
    shadow.sort = mesh.sort;
    shadow.alpha = alpha;
    shadow.visible = true;
    if ( source && flickers(source) ) {
      flickering.set(shadow, { source, x: geom.x, y: geom.y, length: geom.length, rotation: geom.rotation, alpha });
      ensureTicker();
    }
    else flickering.delete(shadow);
    used++;
  }
  for ( let i = used; i < pool.length; i++ ) {
    const shadow = pool[i];
    if ( !shadow || shadow.destroyed ) continue;
    shadow.visible = false;
    flickering.delete(shadow);
  }
}

export function refreshAllCastShadows() {
  if ( !canvas.ready ) return;
  for ( const token of canvas.tokens.placeables ) syncCastShadows(token);
}

export function removeCastShadows(token) {
  const pool = pools.get(token);
  if ( !pool ) return;
  pools.delete(token);
  for ( const shadow of pool ) {
    if ( !shadow ) continue;
    flickering.delete(shadow);
    if ( !shadow.destroyed ) shadow.destroy();
  }
}

function candidates(token) {
  const found = candidateLights(token);
  const sun = currentSun();
  if ( sun && !inSunShade(token, sun) ) found.push({ sun, intensity: sun.strength });
  return found;
}

/**
 * Le token est-il à l'abri du soleil ? Un rayon part de son pied vers le soleil ; s'il traverse une surface qui arrête
 * la lumière (région `defineSurface` avec `light`, cochée par défaut : toit, plafond, étage), le token est à
 * l'ombre — sous un toit, ou, soleil bas, dans l'ombre d'un bâtiment voisin. `Scene#testSurfaceCollision`
 * (client/documents/scene.mjs:846) ne retient que les surfaces strictement au-dessus du départ (côté « below ») :
 * le sol sur lequel se tient le token ne compte pas.
 */
function inSunShade(token, sun) {
  const scene = token.document.parent;
  if ( typeof scene?.testSurfaceCollision !== "function" ) return false;
  const { x, y } = token.center;
  const origin = { x, y, elevation: token.document.elevation };
  const end = sunRayEnd(origin, sun, { distance: canvas.grid.distance, size: canvas.grid.size });
  if ( !end ) return false;
  return scene.testSurfaceCollision(origin, end, { type: "light", mode: "any", level: token.document.level });
}

/**
 * La lumière vacille-t-elle ? Animée d'une flamme : son animation est `animateFlickering` ou `animateTorch`
 * (flame, torch, siren dans `CONFIG.Canvas.lightAnimations`, client/config.mjs:830-852). Les autres animations
 * (pulsation, rotation…) ne touchent pas `brightnessPulse`.
 */
function flickers(source) {
  if ( !(setting("castFlicker") > 0) || !source.isAnimated ) return false;
  const { animateFlickering, animateTorch } = foundry.canvas.sources.PointLightSource.prototype;
  const animation = CONFIG.Canvas.lightAnimations[source.data.animation?.type]?.animation;
  return ((animation === animateFlickering) || (animation === animateTorch)) && Number.isFinite(pulseOf(source));
}

function pulseOf(source) {
  return source.layers?.illumination?.shader?.uniforms?.brightnessPulse;
}

function ensureTicker() {
  if ( tickerAdded ) return;
  canvas.app.ticker.add(tick);
  tickerAdded = true;
}

function tick() {
  if ( !flickering.size ) return;
  const amount = setting("castFlicker");
  for ( const [shadow, base] of flickering ) {
    if ( shadow.destroyed || base.source.destroyed ) {
      flickering.delete(shadow);
      continue;
    }
    if ( !shadow.visible ) continue;
    const f = flicker(pulseOf(base.source), amount);
    const length = base.length * f.length;
    // L'ombre s'allonge vers l'extérieur : son centre avance de la moitié de l'allongement.
    const push = (length - base.length) / 2;
    shadow.position.set(base.x + (Math.cos(base.rotation) * push), base.y + (Math.sin(base.rotation) * push));
    shadow.rotation = base.rotation + f.rotation;
    shadow.width = length;
    shadow.alpha = base.alpha * f.alpha;
  }
}

function candidateLights(token) {
  const { GlobalLightSource } = foundry.canvas.sources;
  const { x, y } = token.center;
  const point = { x, y, elevation: token.document.elevation };
  const found = [];
  for ( const source of canvas.effects.lightSources ) {
    if ( (source instanceof GlobalLightSource) || !source.active || (source.object === token) ) continue;
    const { bright, dim } = source.data;
    const intensity = lightIntensity(Math.hypot(x - source.data.x, y - source.data.y), bright, dim);
    if ( intensity <= 0.05 ) continue;
    if ( !source.testPoint(point) ) continue;
    found.push({ source, intensity });
  }
  return found;
}

/**
 * Hauteur de la lumière au-dessus de son élévation : flag posé par le champ de configuration
 * (ui/light-config.mjs) — `height` sur une lumière d'ambiance, `lightHeight` sur un token —, sinon
 * réglage du monde.
 */
function lightHeightOf(source) {
  const doc = source.object?.document;
  const key = (doc?.documentName === "Token") ? "lightHeight" : "height";
  const flag = doc?.getFlag?.(MODULE_ID, key);
  return Number.isFinite(flag) ? flag : setting("lightHeight");
}

function liveMesh(shadow, token, index) {
  if ( shadow && !shadow.destroyed ) return shadow;
  const { PrimarySpriteMesh } = foundry.canvas.primary;
  shadow = canvas.primary.addChild(new PrimarySpriteMesh({
    name: `${MODULE_ID}.cast.${index}.${token.objectId}`,
    texture: shadowTexture()
  }));
  shadow.anchor.set(0.5, 0.5);
  shadow.eventMode = "none";
  return shadow;
}
