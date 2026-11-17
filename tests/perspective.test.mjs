import { describe, expect, it } from "vitest";
import {
  elevationLift, fadedAlpha, overlaps, PERSPECTIVE_DEFAULTS, perspectiveScale, shadowHeight
} from "../module/scripts/core/perspective.mjs";

const grid = { distance: 5, size: 200 };

describe("elevationLift", () => {
  it("au sol ou en dessous : aucun décalage", () => {
    expect(elevationLift(0, grid)).toBe(0);
    expect(elevationLift(-10, grid)).toBe(0);
  });
  it("proportionnel à l'élévation, en cases", () => {
    // 10 ft = 2 cases × 0,1 = 0,2 case = 40 px
    expect(elevationLift(10, grid)).toBeCloseTo(40);
  });
  it("plafonné : un vol à 120 ft ne part pas trois cases plus loin", () => {
    expect(elevationLift(120, grid)).toBeCloseTo(grid.size * PERSPECTIVE_DEFAULTS.maxLift);
  });
});

describe("perspectiveScale", () => {
  it("même hauteur que la référence : 1", () => {
    expect(perspectiveScale(0, 5)).toBe(1);
  });
  it("plus haut paraît plus grand, plus bas plus petit", () => {
    expect(perspectiveScale(10, 5)).toBeCloseTo(1.08);
    expect(perspectiveScale(-10, 5)).toBeCloseTo(0.92);
  });
  it("borné des deux côtés", () => {
    expect(perspectiveScale(500, 5)).toBeCloseTo(1 + PERSPECTIVE_DEFAULTS.maxScale);
    expect(perspectiveScale(-500, 5)).toBeCloseTo(1 - PERSPECTIVE_DEFAULTS.maxScale);
  });
});

describe("overlaps", () => {
  const a = { x: 0, y: 0, r: 100 };
  it("même case : oui ; cases voisines : non (les bords se touchent sans se chevaucher assez)", () => {
    expect(overlaps(a, { x: 20, y: 0, r: 100 })).toBe(true);
    expect(overlaps(a, { x: 200, y: 0, r: 100 })).toBe(false);
  });
});

describe("shadowHeight", () => {
  it("0 au sol, 1 à une demi-hauteur de token, borné", () => {
    expect(shadowHeight(0, 200)).toBe(0);
    expect(shadowHeight(50, 200)).toBeCloseTo(0.5);
    expect(shadowHeight(500, 200)).toBe(1);
  });
});

describe("fadedAlpha", () => {
  it("sans estompage ni estompage en cours : ne touche pas à l'opacité (celle d'un autre module reste)", () => {
    expect(fadedAlpha(0.2, null, false, 0.5)).toEqual({ alpha: null, memo: null });
  });
  it("estompe à partir de l'opacité trouvée, pas de 1", () => {
    const r = fadedAlpha(0.2, null, true, 0.5);
    expect(r.alpha).toBeCloseTo(0.1);
    expect(r.memo).toEqual({ base: 0.2, written: r.alpha });
  });
  it("ne cumule pas l'estompage d'un rafraîchissement à l'autre", () => {
    const first = fadedAlpha(1, null, true, 0.5);
    const again = fadedAlpha(first.alpha, first.memo, true, 0.5);
    expect(again.alpha).toBeCloseTo(0.5);
  });
  it("fin de l'estompage : rend l'opacité d'avant", () => {
    const first = fadedAlpha(0.8, null, true, 0.5);
    expect(fadedAlpha(first.alpha, first.memo, false, 0.5)).toEqual({ alpha: 0.8, memo: null });
  });
  it("l'opacité a été reposée par quelqu'un d'autre : elle devient la base", () => {
    const first = fadedAlpha(1, null, true, 0.5);
    expect(fadedAlpha(0.3, first.memo, true, 0.5).alpha).toBeCloseTo(0.15);
    expect(fadedAlpha(0.3, first.memo, false, 0.5)).toEqual({ alpha: null, memo: null });
  });
});
