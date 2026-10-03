/**
 * Le soleil de la scène affichée : direction, hauteur et force, ou `null` s'il ne doit pas projeter d'ombre.
 *
 * Il ne brille que si les trois conditions sont réunies :
 * - la scène ne l'a pas coupé (flag `sun` à `false`, case de la configuration de scène, ui/scene-config.mjs —
 *   pour les intérieurs éclairés par une lumière globale) ;
 * - la lumière globale de la scène est active et l'obscurité dans sa plage (`sunlight`, core/sun.mjs — vive ou non :
 *   V14 n'offre plus de case pour ce choix) ; le soleil pâlit quand l'obscurité monte ;
 * - le soleil est levé à l'heure du monde.
 *
 * Heure : Simple Timekeeping & Calendar (`simple-timekeeping` 2.0.3, theRipper93) s'il est là. Il remplace le
 * calendrier du cœur (`CONFIG.time.worldCalendarClass`, scripts/main.js:21-22), donc l'horloge du cœur est déjà la
 * sienne ; il ajoute l'aube et le crépuscule, en fraction de journée : ceux du mois courant s'il les définit, sinon
 * calculés selon la latitude réglée et le jour de l'année, sinon ses réglages (getters `dawn` / `dusk`,
 * scripts/app/SimpleTimekeeping.js:349-359), et l'avancée du jour (`dayTimePercent`, :581). Son instance est
 * `ui.simpleTimekeeping` (:23), créée à son `ready`. Sans lui : `game.time.components` (client/helpers/time.mjs:102),
 * lever à 6 h et coucher à 18 h.
 *
 * Calculé une fois puis gardé jusqu'à `invalidateSun` (heure, scène, éclairage) : il sert à chaque token.
 */

import { coreClock, sunlight, sunPosition } from "../core/sun.mjs";
import { MODULE_ID, setting } from "../settings.mjs";

export const SUN_FLAG = "sun";
export const NORTH_FLAG = "north";

/** @type {{toSun: {x: number, y: number}, altitude: number, strength: number}|null|undefined} */
let cached;

export function invalidateSun() {
  cached = undefined;
}

export function currentSun() {
  if ( cached === undefined ) cached = computeSun();
  return cached;
}

function computeSun() {
  const scene = canvas.scene;
  if ( !scene || (scene.getFlag(MODULE_ID, SUN_FLAG) === false) || !setting("sunShadows") ) return null;
  const global = canvas.environment?.globalLightSource;
  const light = global
    ? sunlight({ active: global.active, darkness: global.data.darkness }, canvas.environment.darknessLevel) : 0;
  if ( !(light > 0.05) ) return null;
  const clock = calendarClock() ?? coreClock(game.time.components ?? {}, game.time.calendar?.days);
  const north = Number(scene.getFlag(MODULE_ID, NORTH_FLAG)) || 0;
  const sun = sunPosition(clock, { north, maxAltitude: setting("sunAltitude") });
  if ( sun ) sun.strength *= light;
  return sun;
}

/** Aube et crépuscule selon Simple Timekeeping, en fraction de journée ; `null` s'il est absent ou répond mal. */
function calendarClock() {
  const keeper = ui.simpleTimekeeping;
  if ( !keeper || !game.modules.get("simple-timekeeping")?.active ) return null;
  try {
    const { dawn, dusk, dayTimePercent: time } = keeper;
    if ( ![dawn, dusk, time].every(Number.isFinite) || !(dusk > dawn) ) return null;
    return { time, sunrise: dawn, sunset: dusk };
  } catch ( err ) {
    return null;
  }
}
