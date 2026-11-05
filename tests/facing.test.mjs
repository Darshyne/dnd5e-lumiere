import { describe, expect, it } from "vitest";
import {
  artOf, FACING_DEFAULTS, facingActive, keepsFacing, nextMirror, turnFactor, turnProgress
} from "../module/scripts/core/facing.mjs";

describe("facingActive", () => {
  it("suit le réglage du monde par défaut", () => {
    expect(facingActive(undefined, true)).toBe(true);
    expect(facingActive({ mode: "setting" }, false)).toBe(false);
  });
  it("toujours / jamais l'emportent sur le monde", () => {
    expect(facingActive({ mode: "always" }, false)).toBe(true);
    expect(facingActive({ mode: "never" }, true)).toBe(false);
  });
});

describe("artOf", () => {
  it("à droite par défaut, à gauche seulement si demandé", () => {
    expect(artOf(undefined)).toBe("right");
    expect(artOf({ art: "n'importe quoi" })).toBe("right");
    expect(artOf({ art: "left" })).toBe("left");
  });
});

describe("nextMirror", () => {
  it("image vers la droite : à droite tel que dessiné, à gauche retourné", () => {
    expect(nextMirror(1, 10, "right")).toBe(1);
    expect(nextMirror(1, -10, "right")).toBe(-1);
  });
  it("image vers la gauche : l'inverse", () => {
    expect(nextMirror(1, 10, "left")).toBe(-1);
    expect(nextMirror(-1, -10, "left")).toBe(1);
  });
  it("un pas vertical ou minuscule garde le sens actuel", () => {
    expect(nextMirror(-1, 0, "right")).toBe(-1);
    expect(nextMirror(-1, FACING_DEFAULTS.threshold / 2, "right")).toBe(-1);
    expect(nextMirror(1, Number.NaN, "right")).toBe(1);
  });
});

describe("turnFactor", () => {
  it("part du miroir de départ et arrive au miroir d'arrivée", () => {
    expect(turnFactor(1, -1, 0)).toBe(1);
    expect(turnFactor(1, -1, 1)).toBe(-1);
    expect(turnFactor(1, -1, 2)).toBe(-1);
  });
  it("passe par zéro à mi-chemin (l'image se resserre)", () => {
    expect(turnFactor(1, -1, 0.5)).toBeCloseTo(0);
    expect(turnFactor(-1, 1, 0.25)).toBeLessThan(0);
  });
});

describe("turnProgress", () => {
  it("de 0 à 1 sur la durée, borné", () => {
    expect(turnProgress(1000, 1000, 150)).toBe(0);
    expect(turnProgress(1000, 1075, 150)).toBeCloseTo(0.5);
    expect(turnProgress(1000, 2000, 150)).toBe(1);
    expect(turnProgress(1000, 900, 150)).toBe(0);
    expect(turnProgress(1000, 1000, 0)).toBe(1);
  });
});

describe("keepsFacing", () => {
  it("un déplacement forcé garde l'orientation", () => {
    expect(keepsFacing([{ action: "displace" }])).toBe(true);
  });
  it("une marche, une téléportation ou un mélange tournent le token", () => {
    expect(keepsFacing([{ action: "walk" }])).toBe(false);
    expect(keepsFacing([{ action: "blink" }])).toBe(false);
    expect(keepsFacing([{ action: "displace" }, { action: "walk" }])).toBe(false);
    expect(keepsFacing([])).toBe(false);
    expect(keepsFacing(undefined)).toBe(false);
  });
});
