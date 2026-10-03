import { describe, expect, it } from "vitest";
import { CAST_DEFAULTS, castShadowGeometry, lightIntensity, pickLights } from "../module/scripts/core/cast-shadow.mjs";

const grid = { distance: 5, size: 100 };
const medium = (x, y, elevation = 0) => ({ x, y, footprint: 100, height: 5, elevation });

describe("lightIntensity", () => {
  it("1 en lumière vive, décroît jusqu'à 0 au bord de la lumière faible", () => {
    expect(lightIntensity(100, 200, 400)).toBe(1);
    expect(lightIntensity(300, 200, 400)).toBeCloseTo(0.5);
    expect(lightIntensity(400, 200, 400)).toBe(0);
    expect(lightIntensity(10, 0, 0)).toBe(0);
  });
});

describe("pickLights", () => {
  it("garde les deux plus fortes, ignore les négligeables", () => {
    const got = pickLights([{ id: "a", intensity: 0.3 }, { id: "b", intensity: 0.9 },
      { id: "c", intensity: 0.02 }, { id: "d", intensity: 0.5 }]);
    expect(got.map(l => l.id)).toEqual(["b", "d"]);
  });
});

describe("castShadowGeometry", () => {
  it("à l'opposé de la lumière", () => {
    // Lumière à gauche du token : l'ombre part vers la droite.
    const g = castShadowGeometry({ token: medium(500, 500), light: { x: 200, y: 500, height: 8 }, grid });
    expect(g.x).toBeGreaterThan(500);
    expect(g.y).toBeCloseTo(500);
    expect(g.rotation).toBeCloseTo(0);
  });

  it("plus la lumière est loin, plus l'ombre est longue (et diffuse), jusqu'au plafond", () => {
    const near = castShadowGeometry({ token: medium(500, 500), light: { x: 400, y: 500, height: 8 }, grid });
    const far = castShadowGeometry({ token: medium(500, 500), light: { x: 100, y: 500, height: 8 }, grid });
    expect(far.length).toBeGreaterThan(near.length);
    expect(far.fade).toBeLessThanOrEqual(near.fade);
    const cap = CAST_DEFAULTS.maxLength * grid.size + 100 * 0.5;
    expect(far.length).toBeLessThanOrEqual(cap + 1e-6);
  });

  it("lumière plus basse que le sommet du token : ombre plafonnée, pas infinie", () => {
    const g = castShadowGeometry({ token: medium(500, 500), light: { x: 400, y: 500, height: 3 }, grid });
    expect(Number.isFinite(g.length)).toBe(true);
  });

  it("token en vol : l'ombre se décolle et pâlit ; au-dessus de la lumière : aucune", () => {
    const ground = castShadowGeometry({ token: medium(500, 500), light: { x: 300, y: 500, height: 20 }, grid });
    const flying = castShadowGeometry({ token: medium(500, 500, 10), light: { x: 300, y: 500, height: 20 }, grid });
    expect(flying.x).toBeGreaterThan(ground.x);
    expect(flying.fade).toBeLessThan(ground.fade);
    expect(castShadowGeometry({ token: medium(500, 500, 30), light: { x: 300, y: 500, height: 20 }, grid }))
      .toBeNull();
  });

  it("lumière sur le token : aucune ombre", () => {
    expect(castShadowGeometry({ token: medium(500, 500), light: { x: 500, y: 500, height: 8 }, grid })).toBeNull();
  });
});
