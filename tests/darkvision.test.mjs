import { describe, expect, it } from "vitest";
import { grantsDarkvision, isDaylight, maskScale, screenToMaskMatrix } from "../module/scripts/core/darkvision.mjs";

const apply = (m, x, y) => [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];

describe("maskScale", () => {
  it("toute la scène dans 2048 texels au plus, jamais agrandie", () => {
    expect(maskScale(8192, 4096)).toBeCloseTo(0.25);
    expect(maskScale(1000, 800)).toBe(1);
  });
});

describe("screenToMaskMatrix", () => {
  it("inverse la transformation du canvas puis ramène la scène à 0–1", () => {
    // monde → écran : zoom 0,5 puis décalage (100, 50)
    const m = screenToMaskMatrix({ a: 0.5, b: 0, c: 0, d: 0.5, tx: 100, ty: 50 }, 4000, 2000);
    // le coin (0,0) de la scène est à l'écran en (100, 50) ; le coin opposé en (2100, 1050)
    const [u0, v0] = apply(m, 100, 50);
    expect(u0).toBeCloseTo(0);
    expect(v0).toBeCloseTo(0);
    const [u, v] = apply(m, 2100, 1050);
    expect(u).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });
  it("transformation non inversible : null", () => {
    expect(screenToMaskMatrix({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 }, 100, 100)).toBeNull();
  });
});

describe("grantsDarkvision", () => {
  it("mode darkvision, portée > 0 et vue active", () => {
    expect(grantsDarkvision({ visionMode: "darkvision", range: 60, hasSight: true })).toBe(true);
    expect(grantsDarkvision({ visionMode: "basic", range: 60, hasSight: true })).toBe(false);
    expect(grantsDarkvision({ visionMode: "darkvision", range: 0, hasSight: true })).toBe(false);
    expect(grantsDarkvision({ visionMode: "darkvision", range: 60, hasSight: false })).toBe(false);
  });
});

describe("plein jour", () => {
  const global = { active: true, bright: 5000, darkness: { min: 0, max: 0.75 } };
  it("lumière globale vive, obscurité dans sa plage", () => {
    expect(isDaylight(global, 0.5)).toBe(true);
    expect(isDaylight(global, 0.75)).toBe(true);
  });
  it("obscurité hors de la plage : la lumière globale ne s'applique pas", () => {
    expect(isDaylight(global, 0.9)).toBe(false);
  });
  it("lumière globale faible ou éteinte : jamais", () => {
    expect(isDaylight({ ...global, bright: 0 }, 0.2)).toBe(false);
    expect(isDaylight({ ...global, active: false }, 0.2)).toBe(false);
  });
});
