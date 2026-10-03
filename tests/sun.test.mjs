import { describe, expect, it } from "vitest";
import { directionalShadowGeometry, flicker } from "../module/scripts/core/cast-shadow.mjs";
import { coreClock, sunPosition } from "../module/scripts/core/sun.mjs";

const grid = { distance: 5, size: 100 };
const medium = (elevation = 0) => ({ x: 500, y: 500, footprint: 100, height: 5, elevation });
const day = { sunrise: 6, sunset: 18 };

describe("sunPosition", () => {
  it("la nuit, rien", () => {
    expect(sunPosition({ ...day, time: 3 })).toBeNull();
    expect(sunPosition({ ...day, time: 18 })).toBeNull();
  });

  it("à l'est au matin, au sud à midi, à l'ouest le soir (nord en haut)", () => {
    expect(sunPosition({ ...day, time: 7 }).toSun.x).toBeGreaterThan(0.9);
    const noon = sunPosition({ ...day, time: 12 });
    expect(noon.toSun.x).toBeCloseTo(0);
    expect(noon.toSun.y).toBeCloseTo(1);
    expect(noon.altitude).toBeCloseTo(55 * Math.PI / 180);
    expect(sunPosition({ ...day, time: 17 }).toSun.x).toBeLessThan(-0.9);
  });

  it("s'efface à l'aube, pleine force plus haut", () => {
    expect(sunPosition({ ...day, time: 6.2 }).strength).toBeLessThan(0.3);
    expect(sunPosition({ ...day, time: 10 }).strength).toBe(1);
  });

  it("nord à droite : le midi est à gauche", () => {
    const noon = sunPosition({ ...day, time: 12 }, { north: 90 });
    expect(noon.toSun.x).toBeCloseTo(-1);
    expect(noon.toSun.y).toBeCloseTo(0);
  });
});

describe("coreClock", () => {
  it("secondes depuis minuit, lever 6 h, coucher 18 h", () => {
    expect(coreClock({ hour: 12, minute: 30, second: 5 })).toEqual({ time: 45005, sunrise: 21600, sunset: 64800 });
  });
});

describe("directionalShadowGeometry", () => {
  it("à l'opposé du soleil, plus longue quand il est bas", () => {
    const high = directionalShadowGeometry({ token: medium(), toLight: { x: 0, y: 1 }, altitude: 1, grid });
    const low = directionalShadowGeometry({ token: medium(), toLight: { x: 0, y: 1 }, altitude: 0.2, grid });
    expect(high.y).toBeLessThan(500);            // soleil au sud : ombre au nord
    expect(high.rotation).toBeCloseTo(-Math.PI / 2);
    expect(low.length).toBeGreaterThan(high.length);
  });

  it("plafonnée, et rien sous l'horizon", () => {
    const g = directionalShadowGeometry({ token: medium(), toLight: { x: 1, y: 0 }, altitude: 0.01, grid }, { maxLength: 3 });
    expect(g.length).toBeLessThanOrEqual(300 + 50 + 1e-6);
    expect(directionalShadowGeometry({ token: medium(), toLight: { x: 1, y: 0 }, altitude: 0, grid })).toBeNull();
  });

  it("un token en vol : l'ombre se détache, et disparaît s'il est trop haut", () => {
    const ground = directionalShadowGeometry({ token: medium(0), toLight: { x: -1, y: 0 }, altitude: 0.8, grid });
    const lifted = directionalShadowGeometry({ token: medium(10), toLight: { x: -1, y: 0 }, altitude: 0.8, grid });
    expect(lifted.x).toBeGreaterThan(ground.x);
    expect(lifted.fade).toBeLessThan(ground.fade);
    expect(directionalShadowGeometry({ token: medium(200), toLight: { x: -1, y: 0 }, altitude: 0.8, grid })).toBeNull();
  });
});

describe("flicker", () => {
  it("flamme moyenne, force nulle ou valeur absente : rien ne change", () => {
    const mid = flicker(0.55 + 0.225);
    expect(mid.alpha).toBeCloseTo(1);
    expect(mid.length).toBeCloseTo(1);
    expect(mid.rotation).toBeCloseTo(0);
    expect(flicker(Number.NaN)).toEqual({ alpha: 1, length: 1, rotation: 0 });
    expect(flicker(0.55, 0)).toEqual({ alpha: 1, length: 1, rotation: 0 });
  });

  it("flamme basse : plus pâle, plus longue ; haute : l'inverse, en moyenne rien", () => {
    const low = flicker(0.55);
    const high = flicker(1);
    expect(low.alpha).toBeCloseTo(0.7);
    expect(low.length).toBeCloseTo(1.1);
    expect(high.alpha).toBeCloseTo(1.3);
    expect(high.length).toBeCloseTo(0.9);
    expect((low.alpha + high.alpha) / 2).toBeCloseTo(1);
    expect(low.rotation).toBeCloseTo(-high.rotation);
  });
});

describe("sunlight", async () => {
  const { sunlight } = await import("../module/scripts/core/sun.mjs");
  it("lumière globale éteinte ou obscurité hors plage : aucun soleil", () => {
    expect(sunlight({ active: false }, 0)).toBe(0);
    expect(sunlight({ active: true, darkness: { min: 0, max: 0.75 } }, 0.8)).toBe(0);
  });
  it("sinon, pâlit avec l'obscurité (vive ou non)", () => {
    expect(sunlight({ active: true, darkness: { min: 0, max: 0.75 } }, 0)).toBe(1);
    expect(sunlight({ active: true, darkness: { min: 0, max: 0.75 } }, 0.25)).toBeCloseTo(0.75);
  });
});

describe("sunRayEnd", async () => {
  const { sunRayEnd } = await import("../module/scripts/core/sun.mjs");
  it("monte vers le soleil ; plus il est bas, plus le rayon s'allonge au sol", () => {
    const origin = { x: 1000, y: 1000, elevation: 10 };
    const high = sunRayEnd(origin, { toSun: { x: 0, y: 1 }, altitude: Math.PI / 4 }, grid, 20);
    expect(high.elevation).toBe(30);
    expect(high.x).toBeCloseTo(1000);
    expect(high.y).toBeCloseTo(1000 + 400);          // 20 ft à 45° = 20 ft au sol = 4 cases
    const low = sunRayEnd(origin, { toSun: { x: 0, y: 1 }, altitude: 0.1 }, grid, 20);
    expect(low.y - 1000).toBeGreaterThan(high.y - 1000);
  });
  it("sans soleil : rien", () => {
    expect(sunRayEnd({ x: 0, y: 0, elevation: 0 }, null, grid)).toBeNull();
  });
});
