import { describe, expect, it } from "vitest";
import { HOVER_DEFAULTS, hoverLift, phaseFromId, shadowResponse } from "../module/scripts/core/hover.mjs";

describe("phaseFromId", () => {
  it("stable, dans [0, 2π), différente d'un token à l'autre", () => {
    const a = phaseFromId("CrbOPG5eatOdZ4yG");
    expect(phaseFromId("CrbOPG5eatOdZ4yG")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(Math.PI * 2);
    expect(phaseFromId("ET0PKMrjlc39yVfI")).not.toBe(a);
  });
});

describe("hoverLift", () => {
  const H = 200;
  it("oscille autour de la hauteur de base, sans jamais redescendre au sol", () => {
    const { period, lift, amplitude } = HOVER_DEFAULTS;
    const samples = Array.from({ length: 40 }, (_, i) => hoverLift(i * period / 40, H, 0).lift);
    expect(Math.max(...samples)).toBeCloseTo(H * (lift + amplitude), 0);
    expect(Math.min(...samples)).toBeCloseTo(H * (lift - amplitude), 0);
    expect(Math.min(...samples)).toBeGreaterThan(0);
  });

  it("ratio 1 au sommet, 0 au creux", () => {
    const { period } = HOVER_DEFAULTS;
    expect(hoverLift(period / 4, H, 0).ratio).toBeCloseTo(1);
    expect(hoverLift(3 * period / 4, H, 0).ratio).toBeCloseTo(0);
  });
});

describe("shadowResponse", () => {
  it("au sol rien ne change ; plus haut, l'ombre rétrécit et pâlit ; bornée", () => {
    expect(shadowResponse(0)).toEqual({ scale: 1, alpha: 1 });
    const top = shadowResponse(1);
    expect(top.scale).toBeCloseTo(1 - HOVER_DEFAULTS.shadowShrink);
    expect(top.alpha).toBeCloseTo(1 - HOVER_DEFAULTS.shadowFade);
    expect(shadowResponse(5)).toEqual(top);
  });
});

describe("approachFlight / flightEase", () => {
  it("monte à vitesse constante et s'arrête à la cible", async () => {
    const { approachFlight } = await import("../module/scripts/core/hover.mjs");
    expect(approachFlight(0, true, 350, { takeoff: 700 })).toBeCloseTo(0.5);
    expect(approachFlight(0.9, true, 700, { takeoff: 700 })).toBe(1);
    expect(approachFlight(1, false, 250, { landing: 500 })).toBeCloseTo(0.5);
    expect(approachFlight(0.1, false, 500, { landing: 500 })).toBe(0);
    expect(approachFlight(0.3, true, 0)).toBeCloseTo(0.3);
  });

  it("douce aux deux bouts", async () => {
    const { flightEase } = await import("../module/scripts/core/hover.mjs");
    expect(flightEase(0)).toBe(0);
    expect(flightEase(1)).toBe(1);
    expect(flightEase(0.5)).toBeCloseTo(0.5);
    expect(flightEase(0.1)).toBeLessThan(0.1);
  });
});
