/**
 * Sons portés (étape 13) : un bruit d'ambiance porté par un token ou une région, un son de repos et un son de combat.
 *
 * Chaque porteur est une source sonore du cœur V14 **sans AmbientSound** (`PointSoundSource`, client/canvas/sources/
 * point-sound-source.mjs), posée dans `canvas.sounds.sources` : le calque des sons du cœur (client/canvas/layers/sounds.mjs:120-237)
 * fait le reste sur chaque client — auditeurs (les tokens de ce client), distance et adoucissement, murs (coupé ou étouffé), un seul
 * son par fichier au volume du porteur le plus proche (dix loups ne grognent pas à l'unisson), canal environnement (curseur
 * « Ambiance » de chaque joueur). Rien n'est écrit : la source n'existe que sur ce client.
 *
 * Le réglage vient du token (`flags.dnd5e-lumiere.sound`, ui/sound-config.mjs ; celui du prototype suit sur les tokens posés) ou d'un
 * comportement de région « Son d'ambiance (DAS) » (canvas/sound-behavior.mjs). Une région joue depuis son point le plus proche de
 * l'auditeur : plein volume dedans, décroissant au-delà du bord sur la portée choisie.
 */

import { SOUND_DEFAULTS, clampElevation, nearestPointOnPolygons, pickPath, silenced, soundConfig } from "../core/carried-sound.mjs";
import { MODULE_ID, setting } from "../settings.mjs";
import { SOUND_BEHAVIOR } from "./sound-behavior.mjs";

export const SOUND_FLAG = "sound";

/** clé → { source, key } ; clé « Token.<id> » ou « Region.<id> ». */
const sources = new Map();

const enabled = () => setting("carriedSounds") && !!canvas?.ready;
const gridDistance = () => canvas.scene?.grid?.distance ?? canvas.dimensions?.distance ?? 5;

/** Les tokens d'où ce client écoute (comme la vue Éthérée) : ceux qu'il contrôle, sinon (joueur) ceux qu'il possède. */
function viewers() {
  const controlled = canvas.tokens?.controlled ?? [];
  if ( controlled.length || game.user.isGM ) return controlled;
  return (canvas.tokens?.placeables ?? []).filter(t => t.isOwner);
}

const isEthereal = actor => actor?.statuses?.has?.("ethereal") === true;
const listenerEthereal = () => viewers().some(t => isEthereal(t.actor));

/** Un combat est-il en cours sur la scène affichée ? */
const sceneInCombat = () => game.combats?.some(c => c.started && (!c.scene || (c.scene === canvas.scene))) ?? false;

function isDead(actor) {
  if ( !actor ) return false;
  if ( actor.statuses?.has?.(CONFIG.specialStatusEffects?.DEFEATED ?? "dead") ) return true;
  const hp = actor.system?.attributes?.hp;
  return Number.isFinite(hp?.value) && Number.isFinite(hp?.max) && (hp.max > 0) && (hp.value <= 0);
}

/** Caché par la Furtivité du moteur de combat (un effet marqué `flags.dnd5e-combat.hidden`), lu sans le moteur. */
const stealthHidden = actor => !!actor?.effects?.some?.(e => !e.disabled && e.getFlag?.("dnd5e-combat", "hidden"));

function sourceFor(key) {
  let entry = sources.get(key);
  if ( !entry ) {
    const cls = CONFIG.Canvas.soundSourceClass;
    entry = { source: new cls({ sourceId: `${MODULE_ID}.${key}` }), data: null };
    sources.set(key, entry);
  }
  return entry;
}

/** Pose (ou met à jour) la source de cette clé ; rend true si quelque chose a changé. */
function apply(key, data) {
  const entry = sourceFor(key);
  const same = entry.data && Object.keys(data).every(k => (k === "effects") || (entry.data[k] === data[k]));
  if ( same ) return false;
  entry.data = data;
  entry.source.initialize(data);
  entry.source.add();
  return true;
}

function drop(key) {
  const entry = sources.get(key);
  if ( !entry ) return false;
  sources.delete(key);
  entry.source.remove();
  entry.source.destroy();
  return true;
}

const baseData = (config, x, y, elevation, level, path, disabled) => ({
  x, y, elevation, level, radius: config.radius * canvas.dimensions.distancePixels, walls: config.walls, path: path || null,
  volume: config.volume, easing: true, effects: { base: {}, muffled: { ...SOUND_DEFAULTS.muffled } }, disabled: disabled || !path
});

/* -------------------------------------------- */
/*  Tokens                                      */
/* -------------------------------------------- */

/** Synchronise le son porté d'un token ; rend true si la source a changé. */
function syncToken(token) {
  const key = `Token.${token.document.id}`;
  const config = enabled() && !token.destroyed ? soundConfig(token.document.getFlag(MODULE_ID, SOUND_FLAG), gridDistance()) : null;
  if ( !config ) return drop(key);
  const actor = token.actor;
  const inCombat = !!token.document.combatant && !!game.combat?.started;
  const path = pickPath(config, inCombat);
  const quiet = silenced({ hidden: token.document.hidden, dead: isDead(actor), stealth: stealthHidden(actor), ethereal: isEthereal(actor),
    listenerEthereal: listenerEthereal() });
  const { x, y } = token.center;
  const level = token.document.level ?? canvas.level?.id;
  return apply(key, baseData(config, Math.round(x), Math.round(y), token.document.elevation, level, path, quiet));
}

/* -------------------------------------------- */
/*  Régions                                     */
/* -------------------------------------------- */

const soundBehavior = region => region.document.behaviors?.find(b => (b.type === SOUND_BEHAVIOR) && !b.disabled) ?? null;

/** Le point d'où la région joue pour l'auditeur le plus proche (dedans : l'auditeur lui-même). */
function regionOrigin(region, listeners) {
  const doc = region.document;
  const polygons = (doc.polygons ?? []).map(p => p.points);
  const { bottom, top } = doc.elevation ?? {};
  let best = null;
  for ( const l of listeners ) {
    const elevation = clampElevation(l.elevation, bottom, top);
    const inside = doc.testPoint?.({ x: l.x, y: l.y, elevation }) ?? false;
    const p = inside ? { x: l.x, y: l.y } : nearestPointOnPolygons(l, polygons);
    if ( !p ) continue;
    const d = Math.hypot(p.x - l.x, p.y - l.y);
    if ( !best || (d < best.d) ) best = { x: p.x, y: p.y, elevation, d };
  }
  if ( best ) return best;
  // Personne n'écoute : la source reste au centre de la région, sans effet.
  const { x, y } = region.bounds?.center ?? { x: 0, y: 0 };
  return { x, y, elevation: clampElevation(canvas.level?.elevation?.base ?? 0, bottom, top) };
}

/** Synchronise le son d'une région ; rend true si la source a changé. */
function syncRegion(region, listeners) {
  const key = `Region.${region.document.id}`;
  const behavior = enabled() ? soundBehavior(region) : null;
  const config = behavior ? soundConfig(behavior.system, gridDistance()) : null;
  if ( !config ) return drop(key);
  const path = pickPath(config, sceneInCombat());
  const o = regionOrigin(region, listeners);
  const level = region.document.levels?.first?.() ?? canvas.level?.id;
  return apply(key, baseData(config, Math.round(o.x), Math.round(o.y), o.elevation, level, path, false));
}

/* -------------------------------------------- */
/*  Ensemble                                    */
/* -------------------------------------------- */

const refreshSounds = () => canvas.perception?.update({ refreshSounds: true });

/** Tous les porteurs de la scène : au dessin de la scène, à un combat, à un réglage changé. */
export function syncAllSounds() {
  if ( !canvas?.ready ) return;
  let changed = false;
  const seen = new Set();
  for ( const token of canvas.tokens.placeables ) {
    seen.add(`Token.${token.document.id}`);
    changed = syncToken(token) || changed;
  }
  const listeners = canvas.sounds.getListenerPositions();
  for ( const region of canvas.regions?.placeables ?? [] ) {
    seen.add(`Region.${region.document.id}`);
    changed = syncRegion(region, listeners) || changed;
  }
  for ( const key of [...sources.keys()] ) if ( !seen.has(key) ) changed = drop(key) || changed;
  if ( changed ) refreshSounds();
}
export const syncAllSoundsSoon = foundry.utils.debounce(syncAllSounds, 60);

/** Les régions seules, l'auditeur ayant bougé. */
function syncRegions() {
  if ( !canvas?.ready || ![...sources.keys()].some(k => k.startsWith("Region.")) ) return;
  const listeners = canvas.sounds.getListenerPositions();
  let changed = false;
  for ( const region of canvas.regions?.placeables ?? [] ) changed = syncRegion(region, listeners) || changed;
  if ( changed ) refreshSounds();
}
const syncRegionsSoon = foundry.utils.throttle(syncRegions, 100);

/** Un token a bougé : sa propre source suit (au plus toutes les 100 ms pendant la marche), et les régions suivent l'auditeur. */
const moving = new Map();
export function onTokenMoved(token) {
  if ( !sources.size ) return;
  const id = token.document.id;
  // Un token sans son ne fait que déplacer l'auditeur : seules les régions suivent.
  if ( sources.has(`Token.${id}`) && !moving.has(id) ) {
    moving.set(id, setTimeout(() => {
      moving.delete(id);
      if ( !token.destroyed && syncToken(token) ) refreshSounds();
    }, 100));
  }
  syncRegionsSoon();
}

export function removeTokenSound(token) {
  if ( drop(`Token.${token.document.id}`) ) refreshSounds();
}

export function removeAllSounds() {
  for ( const key of [...sources.keys()] ) drop(key);
  for ( const timer of moving.values() ) clearTimeout(timer);
  moving.clear();
}

/** Les hooks : posés une fois, à `init`. */
export function registerCarriedSounds() {
  Hooks.on("canvasReady", () => syncAllSounds());
  Hooks.on("canvasTearDown", () => removeAllSounds());
  // Réglage, état ou combat d'un porteur changé.
  Hooks.on("updateToken", (doc, changes) => {
    if ( ("hidden" in changes) || foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) ) syncAllSoundsSoon();
  });
  Hooks.on("updateActor", (actor, changes) => {
    if ( foundry.utils.hasProperty(changes, "system.attributes.hp") ) syncAllSoundsSoon();
  });
  for ( const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"] ) Hooks.on(hook, () => syncAllSoundsSoon());
  for ( const hook of ["createCombat", "updateCombat", "deleteCombat", "createCombatant", "deleteCombatant"] ) {
    Hooks.on(hook, () => syncAllSoundsSoon());
  }
  for ( const hook of ["createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior", "updateRegion", "deleteRegion"] ) {
    Hooks.on(hook, () => syncAllSoundsSoon());
  }
  // Changer de token écouté change qui est Éthéré, et d'où les régions jouent.
  Hooks.on("controlToken", () => syncAllSoundsSoon());
}
