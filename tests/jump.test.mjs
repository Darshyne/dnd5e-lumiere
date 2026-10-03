import { describe, expect, it } from "vitest";
import { JUMP_DEFAULTS, jumpLift, jumpPeak, jumpProgress } from "../module/scripts/core/jump.mjs";

describe("jumpPeak", () => {
  const G = 140;
  it("proportionnelle à la longueur du saut, entre un plancher et un plafond en cases", () => {
    expect(jumpPeak(3 * G, G)).toBeCloseTo(3 * G * JUMP_DEFAULTS.height);
    expect(jumpPeak(0.5 * G, G)).toBeCloseTo(JUMP_DEFAULTS.minHeight * G);
    expect(jumpPeak(20 * G, G)).toBeCloseTo(JUMP_DEFAULTS.maxHeight * G);
  });
  it("nulle sans distance, sans grille, ou réglée à 0", () => {
    expect(jumpPeak(0, G)).toBe(0);
    expect(jumpPeak(300, 0)).toBe(0);
    expect(jumpPeak(300, G, { height: 0 })).toBe(0);
  });
});

describe("jumpProgress", () => {
  const from = { x: 100, y: 100 };
  const to = { x: 500, y: 100 };
  it("0 au départ, 1 à l'arrivée, la part parcourue entre les deux", () => {
    expect(jumpProgress(from, to, from)).toBe(0);
    expect(jumpProgress(from, to, to)).toBe(1);
    expect(jumpProgress(from, to, { x: 200, y: 100 })).toBeCloseTo(0.25);
  });
  it("bornée, et projetée sur le segment (l'arc lui-même décale le visuel)", () => {
    expect(jumpProgress(from, to, { x: 50, y: 100 })).toBe(0);
    expect(jumpProgress(from, to, { x: 900, y: 100 })).toBe(1);
    expect(jumpProgress(from, to, { x: 300, y: 40 })).toBeCloseTo(0.5);
  });
  it("segment nul : arrivé", () => {
    expect(jumpProgress(from, from, from)).toBe(1);
  });
});

describe("jumpLift", () => {
  it("parabole : nulle aux deux bouts, le sommet au milieu, symétrique", () => {
    expect(jumpLift(0, 100)).toBe(0);
    expect(jumpLift(1, 100)).toBe(0);
    expect(jumpLift(0.5, 100)).toBeCloseTo(100);
    expect(jumpLift(0.25, 100)).toBeCloseTo(jumpLift(0.75, 100));
  });
});
