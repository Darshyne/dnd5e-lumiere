/**
 * Course du soleil, pour ses ombres portées. Calcul pur.
 *
 * Modèle volontairement simple, hémisphère nord : le soleil se lève à l'est, passe au sud à midi et se couche à
 * l'ouest ; sa hauteur suit un demi-sinus entre le lever et le coucher, jusqu'à `maxAltitude` à midi. Sur la
 * carte, le nord est en haut (y vers le bas = sud), sauf si la scène indique un autre nord.
 */

export const SUN_DEFAULTS = Object.freeze({
  maxAltitude: 55,  // hauteur du soleil à midi, en degrés
  twilight: 12,     // en dessous de cette hauteur (degrés), l'ombre s'efface vers l'horizon
  sunrise: 0.25,    // lever et coucher, en fraction de journée, quand aucun calendrier ne les donne
  sunset: 0.75,
  rayRise: 200      // hauteur du rayon vers le soleil testée contre les toits, en unités de scène (pieds)
});

/**
 * Position du soleil à un instant de la journée.
 * @param {{time: number, sunrise: number, sunset: number}} clock  Même unité pour les trois (secondes).
 * @param {object} [options]
 * @param {number} [options.maxAltitude]   Degrés.
 * @param {number} [options.twilight]      Degrés.
 * @param {number} [options.north]         Orientation du nord sur la carte, en degrés dans le sens horaire depuis
 *   le haut (0 = nord en haut, 90 = nord à droite).
 * @returns {{toSun: {x: number, y: number}, altitude: number, strength: number}|null}  Direction du soleil sur
 *   la carte (unitaire), hauteur en radians, force ∈ ]0, 1] (s'efface à l'aube et au crépuscule) ; `null` la nuit.
 */
export function sunPosition({ time, sunrise, sunset }, options = {}) {
  const { maxAltitude, twilight, north = 0 } = { ...SUN_DEFAULTS, ...options };
  if ( !(sunset > sunrise) ) return null;
  const t = (time - sunrise) / (sunset - sunrise);
  if ( !(t > 0) || !(t < 1) ) return null;
  const altitude = toRad(maxAltitude) * Math.sin(Math.PI * t);
  // Est (+x) au lever, sud (+y) à midi, ouest (−x) au coucher, puis tourné selon le nord de la scène.
  const theta = (Math.PI * t) + toRad(north);
  const strength = Math.min(1, altitude / toRad(Math.max(twilight, 1e-3)));
  if ( !(strength > 0) ) return null;
  return { toSun: { x: Math.cos(theta), y: Math.sin(theta) }, altitude, strength };
}

/**
 * Part de la lumière du jour que le soleil garde sur la scène : 0 si la lumière globale est éteinte ou si l'obscurité
 * sort de sa plage `darkness` (le cœur ne l'applique alors pas, sources/global-light-source.mjs:76-80), sinon
 * 1 − obscurité (le soleil pâlit quand l'obscurité monte, au crépuscule ou par temps couvert).
 *
 * Contrairement au plein jour du flou (`isDaylight`), la lumière globale n'a pas à être **vive** : V14 n'offre plus
 * de case pour ce champ (`environment.globalLight.bright`, common/documents/scene.mjs:122, absent de
 * templates/scene/config/visibility.hbs), qui reste donc à `false` sur presque toutes les scènes.
 * @param {{active: boolean, darkness?: {min?: number, max?: number}}} global
 * @param {number} darknessLevel   Obscurité de la scène (0–1).
 * @returns {number}
 */
export function sunlight({ active, darkness = {} }, darknessLevel) {
  const { min = 0, max = 1 } = darkness;
  if ( !active || (darknessLevel < min) || (darknessLevel > max) ) return 0;
  return Math.min(1, Math.max(0, 1 - darknessLevel));
}

/**
 * Extrémité du rayon qui part d'un point vers le soleil et monte de `rise` unités de scène : c'est ce rayon qu'on
 * teste contre les surfaces (toits, plafonds, étages) pour savoir si le point est à l'ombre. Un soleil bas donne un
 * rayon très oblique, qui peut heurter un bâtiment voisin : le token est alors dans l'ombre de ce bâtiment.
 * @param {{x: number, y: number, elevation: number}} origin   Position (px), élévation (unités).
 * @param {{toSun: {x: number, y: number}, altitude: number}} sun
 * @param {{distance: number, size: number}} grid
 * @param {number} [rise]   Hauteur de rayon testée, en unités de scène.
 * @returns {{x: number, y: number, elevation: number}|null}
 */
export function sunRayEnd(origin, sun, grid, rise = SUN_DEFAULTS.rayRise) {
  if ( !(sun?.altitude > 0) || !(grid.distance > 0) || !(rise > 0) ) return null;
  const run = (rise / Math.tan(Math.min(sun.altitude, (Math.PI / 2) - 1e-3))) * (grid.size / grid.distance);
  const norm = Math.hypot(sun.toSun.x, sun.toSun.y) || 1;
  return {
    x: origin.x + ((sun.toSun.x / norm) * run),
    y: origin.y + ((sun.toSun.y / norm) * run),
    elevation: origin.elevation + rise
  };
}

/**
 * Horloge du jour tirée des composantes de l'horloge du cœur, quand aucun calendrier ne donne lever et coucher.
 * @param {{hour?: number, minute?: number, second?: number}} components
 * @param {{hoursPerDay?: number, minutesPerHour?: number, secondsPerMinute?: number}} [days]
 * @returns {{time: number, sunrise: number, sunset: number}}  En secondes depuis minuit.
 */
export function coreClock({ hour = 0, minute = 0, second = 0 }, days = {}) {
  const { hoursPerDay = 24, minutesPerHour = 60, secondsPerMinute = 60 } = days;
  const day = hoursPerDay * minutesPerHour * secondsPerMinute;
  return {
    time: (((hour * minutesPerHour) + minute) * secondsPerMinute) + second,
    sunrise: day * SUN_DEFAULTS.sunrise,
    sunset: day * SUN_DEFAULTS.sunset
  };
}

function toRad(deg) {
  return deg * Math.PI / 180;
}
