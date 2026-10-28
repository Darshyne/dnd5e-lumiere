/**
 * Sons portés (étape 13, demande de l'utilisateur, 2026-10-28) : un bruit d'ambiance porté par une créature (son token) ou par une zone
 * (une région), avec un son de **repos** et un son de **combat**. La lecture, la distance, les murs et l'étouffement sont ceux du cœur
 * (une source sonore V14 sans AmbientSound, canvas/carried-sounds.mjs) ; ici, le calcul pur : réglage lu, son choisi, silence, et le
 * point d'une zone le plus proche d'un auditeur.
 */

export const SOUND_DEFAULTS = Object.freeze({
  radiusCells: 6,   // portée par défaut, en cases de la scène (30 ft sur une grille de 5 ft)
  volume: 0.5,      // comme un AmbientSound neuf du cœur
  walls: false,     // false : étouffé derrière un mur ; true : coupé net
  muffled: { type: "lowpass", intensity: 5 }  // l'étouffement, un effet du cœur (CONFIG.soundEffects)
});

const num = (value, fallback) => (Number.isFinite(Number(value)) && (value !== "") && (value !== null)) ? Number(value) : fallback;
const path = value => (typeof value === "string") ? value.trim() : "";

/**
 * Le réglage d'un porteur, normalisé (flag d'un token, données d'un comportement de région). Rend null quand il n'y a aucun son.
 * `radius` est en unités de la scène ; vide, il vaut `radiusCells` cases (`gridDistance` = taille d'une case).
 * @param {object|null|undefined} raw
 * @param {number} gridDistance
 * @returns {{idle: string, combat: string, radius: number, volume: number, walls: boolean}|null}
 */
export function soundConfig(raw, gridDistance) {
  if ( !raw || (typeof raw !== "object") ) return null;
  const idle = path(raw.idle);
  const combat = path(raw.combat);
  if ( !idle && !combat ) return null;
  const radius = num(raw.radius, SOUND_DEFAULTS.radiusCells * num(gridDistance, 5));
  if ( radius <= 0 ) return null;
  return {
    idle, combat, radius,
    volume: Math.min(1, Math.max(0, num(raw.volume, SOUND_DEFAULTS.volume))),
    walls: raw.walls === true
  };
}

/**
 * Le son à jouer : celui de combat tant que le porteur est dans un combat en cours, s'il en a un ; sinon celui de repos. Rend "" quand
 * il n'y a rien à jouer dans cet état (un porteur sans son de repos se tait hors combat).
 */
export function pickPath(config, inCombat) {
  if ( !config ) return "";
  if ( inCombat && config.combat ) return config.combat;
  return config.idle;
}

/**
 * Le porteur doit-il se taire ? Masqué par le MJ, mort, caché (Furtivité du moteur), ou dans le plan Éthéré quand ce client n'écoute
 * pas depuis l'Éthéré.
 */
export function silenced({ hidden=false, dead=false, stealth=false, ethereal=false, listenerEthereal=false }={}) {
  return hidden || dead || stealth || (ethereal && !listenerEthereal);
}

/** Le point du segment [a, b] le plus proche de p. */
function nearestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = (dx * dx) + (dy * dy);
  const t = len2 ? Math.min(1, Math.max(0, (((px - ax) * dx) + ((py - ay) * dy)) / len2)) : 0;
  return { x: ax + (t * dx), y: ay + (t * dy) };
}

/**
 * Le point du bord de ces polygones (coordonnées à plat [x0, y0, x1, y1, …], fermés) le plus proche de `point`. Une zone joue son son
 * depuis ce point : à plein volume à l'intérieur (l'appelant passe alors le point lui-même), décroissant au-delà du bord.
 * @returns {{x: number, y: number}|null}
 */
export function nearestPointOnPolygons(point, polygons) {
  let best = null;
  let bestD2 = Infinity;
  for ( const points of polygons ?? [] ) {
    const n = Math.floor((points?.length ?? 0) / 2);
    for ( let i = 0; i < n; i++ ) {
      const j = (i + 1) % n;
      const q = nearestOnSegment(point.x, point.y, points[2 * i], points[(2 * i) + 1], points[2 * j], points[(2 * j) + 1]);
      const d2 = ((q.x - point.x) ** 2) + ((q.y - point.y) ** 2);
      if ( d2 < bestD2 ) { bestD2 = d2; best = q; }
    }
  }
  return best;
}

/** L'élévation de l'auditeur ramenée dans la tranche d'une zone (bas, haut ; null = sans limite). */
export function clampElevation(elevation, bottom, top) {
  let e = num(elevation, 0);
  if ( Number.isFinite(bottom) ) e = Math.max(e, bottom);
  if ( Number.isFinite(top) ) e = Math.min(e, top);
  return e;
}
