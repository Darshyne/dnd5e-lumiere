import { describe, it, expect } from "vitest";
import { ETHEREAL_DEFAULTS, clamp01, haloSize, rgbOf } from "../module/scripts/core/ethereal.mjs";

describe("plan Éthéré : la vue depuis l'Éthéré", () => {
  it("couleurs « #rrggbb » en 0–1, une couleur illisible prend le défaut", () => {
    expect(rgbOf("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(rgbOf("00ff00")).toEqual([0, 1, 0]);
    expect(rgbOf("pas une couleur")).toEqual(rgbOf(ETHEREAL_DEFAULTS.tint));
  });

  it("le halo suit le plus grand côté du token", () => {
    expect(haloSize(100, 50, 1.5)).toBe(150);
    expect(haloSize(-80, 40, 1)).toBe(80);
  });

  it("valeurs bornées entre 0 et 1, défaut si illisible", () => {
    expect(clamp01(2, 0.5)).toBe(1);
    expect(clamp01(-1, 0.5)).toBe(0);
    expect(clamp01("x", 0.5)).toBe(0.5);
  });
});
