/**
 * Ombres portées par les lumières (étape 4). Calcul pur.
 *
 * Modèle : une lumière ponctuelle à la hauteur hL au-dessus du sol, un token vu comme une colonne de
 * sa base (élévation e au-dessus du sol) à son sommet (e + H). Sur le sol, l'ombre va du pied projeté
 * au sommet projeté, dans la direction lumière → token ; un point à la hauteur z, à la distance
 * horizontale d de la lumière, se projette à d · hL / (hL − z). L'ombre est ensuite dessinée comme une
 * ellipse (décision de l'utilisateur) couvrant ce segment.
 */

export const CAST_DEFAULTS = Object.freeze({
  intensity: 0.6,   // opacité d'une ombre portée sous une lumière vive, avant atténuation
  lightHeight: 12,  // hauteur d'une lumière au-dessus de son élévation, en unités de scène (pieds)
  maxLength: 3,     // longueur maximale de l'ombre, en cases
  width: 0.8,       // largeur de l'ombre / largeur du token
  maxShadows: 2,    // lumières retenues par token
  flicker: 1        // force du vacillement d'une ombre sous une flamme
});

/**
 * Éclairement reçu d'une lumière, de 1 dans la lumière vive à 0 au bord de la lumière faible.
 * @param {number} d        Distance lumière → token, en pixels.
 * @param {number} bright   Rayon de lumière vive, en pixels.
 * @param {number} dim      Rayon de lumière faible, en pixels.
 */
export function lightIntensity(d, bright, dim) {
  const outer = Math.max(bright, dim);
  if ( !(outer > 0) || (d >= outer) ) return 0;
  if ( d <= bright ) return 1;
  return 1 - (d - bright) / (outer - bright);
}

/**
 * Les lumières retenues : les plus fortes d'abord, au plus `max`, en ignorant les éclairements négligeables.
 * @template {{intensity: number}} T
 * @param {T[]} candidates
 * @returns {T[]}
 */
export function pickLights(candidates, max = CAST_DEFAULTS.maxShadows) {
  return candidates
    .filter(c => c.intensity > 0.05)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, max);
}

/**
 * Géométrie d'une ombre portée, en pixels, centrée sur la scène.
 * @param {object} args
 * @param {{x: number, y: number, footprint: number, height: number, elevation: number}} args.token
 *   Centre (px), largeur au sol (px), hauteur et élévation au-dessus du sol (unités de scène).
 * @param {{x: number, y: number, height: number}} args.light  Position (px), hauteur au-dessus du sol (unités).
 * @param {{distance: number, size: number}} args.grid
 * @param {Partial<typeof CAST_DEFAULTS>} [options]
 * @returns {{x: number, y: number, length: number, width: number, rotation: number, fade: number}|null}
 *   `null` si la lumière est sur le token ou sous sa base (pas d'ombre au sol).
 */
export function castShadowGeometry({ token, light, grid }, options = {}) {
  const { maxLength } = { ...CAST_DEFAULTS, ...options };
  const dx = token.x - light.x;
  const dy = token.y - light.y;
  const dPx = Math.hypot(dx, dy);
  if ( (dPx < 1) || !(grid.distance > 0) || !(grid.size > 0) ) return null;
  const d = dPx * grid.distance / grid.size;
  const hL = light.height;
  const base = Math.max(0, token.elevation);
  if ( hL <= base ) return null;

  const cap = maxLength * grid.distance;
  const project = z => (hL - z > 1e-6) ? d * hL / (hL - z) : Infinity;
  const start = project(base);
  const end = Math.min(project(base + token.height), start + cap);
  if ( !Number.isFinite(start) || (start - d > cap) ) return null;
  return shadowEllipse(token, { x: dx / dPx, y: dy / dPx }, start - d, end - start, grid, options);
}

/**
 * Ombre portée par une lumière à l'infini (le soleil) : rayons parallèles venant de la direction `toLight`,
 * sous l'angle `altitude` au-dessus de l'horizon. Même colonne que `castShadowGeometry` : un point à la
 * hauteur z se projette à z / tan(altitude) du pied du token.
 * @param {object} args
 * @param {{x: number, y: number, footprint: number, height: number, elevation: number}} args.token
 * @param {{x: number, y: number}} args.toLight   Direction du token vers la lumière, sur la carte.
 * @param {number} args.altitude                  Hauteur angulaire, en radians (0 = horizon).
 * @param {{distance: number, size: number}} args.grid
 * @param {Partial<typeof CAST_DEFAULTS>} [options]
 * @returns {{x: number, y: number, length: number, width: number, rotation: number, fade: number}|null}
 *   `null` sous l'horizon, ou si un token en vol est si haut que son ombre tomberait au-delà du plafond.
 */
export function directionalShadowGeometry({ token, toLight, altitude, grid }, options = {}) {
  const { maxLength } = { ...CAST_DEFAULTS, ...options };
  const norm = Math.hypot(toLight.x, toLight.y);
  if ( !(norm > 0) || !(altitude > 0) || !(grid.distance > 0) || !(grid.size > 0) ) return null;
  const cap = maxLength * grid.distance;
  const tan = Math.tan(Math.min(altitude, (Math.PI / 2) - 1e-3));
  const offset = Math.max(0, token.elevation) / tan;
  if ( offset > cap ) return null;
  const segment = Math.min(token.height / tan, cap);
  return shadowEllipse(token, { x: -toLight.x / norm, y: -toLight.y / norm }, offset, segment, grid, options);
}

/**
 * L'ellipse qui couvre l'ombre projetée : elle commence à `offset` (unités de scène) du pied du token et
 * s'étend sur `segment` (unités), dans la direction unitaire `u` (lumière → token).
 */
function shadowEllipse(token, u, offset, segment, grid, options) {
  const { width } = { ...CAST_DEFAULTS, ...options };
  const pxPerUnit = grid.size / grid.distance;
  const w = token.footprint * width;
  const startPx = offset * pxPerUnit;                    // 0 pour un token au sol : l'ombre part de lui
  const length = Math.max(w, (segment * pxPerUnit) + (token.footprint * 0.5));
  const along = startPx + (length / 2) - (token.footprint * 0.25);

  // Plus l'ombre est longue, plus elle est diffuse ; décollée du sol, elle pâlit aussi.
  const base = Math.max(0, token.elevation);
  const stretch = Math.min(1, Math.max(0.35, (token.footprint * 1.5) / length));
  const lifted = 1 - Math.min(0.6, base / Math.max(token.height * 4, 1e-6));
  return {
    x: token.x + (u.x * along),
    y: token.y + (u.y * along),
    length,
    width: w,
    rotation: Math.atan2(u.y, u.x),
    fade: stretch * lifted
  };
}

/**
 * Vacillement d'une ombre sous une flamme (feu, torche, sirène). Le cœur pose chaque image
 * `brightnessPulse` = 0,55 + bruit, bruit ∈ [0 ; 0,45 × amplification] (sources/base-light-source.mjs:269-290),
 * à n'appeler que pour une flamme. Flamme basse ⇒ ombre plus pâle, un peu plus longue, légèrement déviée ;
 * flamme haute ⇒ l'inverse. Centré sur la flamme moyenne (bruit à mi-course, vu en jeu le 2026-09-30 : centré sur
 * la flamme pleine, les ombres pâlissaient d'un quart en moyenne), pour garder l'intensité réglée.
 * @param {number} pulse    `brightnessPulse` de la couche d'illumination.
 * @param {number} amount   Force du vacillement (0 = aucun, 1 = défaut).
 * @returns {{alpha: number, length: number, rotation: number}}  Facteurs d'opacité et de longueur, écart d'angle
 *   en radians.
 */
export function flicker(pulse, amount = CAST_DEFAULTS.flicker) {
  if ( !Number.isFinite(pulse) || !(amount > 0) ) return { alpha: 1, length: 1, rotation: 0 };
  const n = Math.min(1, Math.max(0, (pulse - 0.55) / 0.45));   // 0 = flamme au plus bas, 1 = pleine
  const dev = (n - 0.5) * amount;                                  // ∈ [−0,5 ; 0,5] × force
  return {
    alpha: Math.max(0, 1 + (0.6 * dev)),
    length: Math.max(0.5, 1 - (0.2 * dev)),
    rotation: 0.08 * dev
  };
}
