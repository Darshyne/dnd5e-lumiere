import { describe, expect, it } from "vitest";
import { CONTACT_DEFAULTS, contactShadowGeometry } from "../module/scripts/core/contact-shadow.mjs";

describe("contactShadowGeometry", () => {
  it("token moyen (100 px) : ellipse qui dépasse du token, décalée vers le bas", () => {
    const g = contactShadowGeometry({ width: 100, height: 100 });
    expect(g.width).toBeCloseTo(100 * CONTACT_DEFAULTS.size);
    expect(g.height).toBeCloseTo(100 * CONTACT_DEFAULTS.size * CONTACT_DEFAULTS.aspect);
    expect(g.offsetY).toBeCloseTo(100 * CONTACT_DEFAULTS.offsetY);
    expect(g.alpha).toBe(CONTACT_DEFAULTS.opacity);
  });

  it("ignore l'échelle de l'image : seule la taille du token compte", () => {
    const g = contactShadowGeometry({ width: 200, height: 200, scaleX: 2, scaleY: 2 });
    expect(g.width).toBeCloseTo(200 * CONTACT_DEFAULTS.size);
    expect(g.offsetY).toBeCloseTo(200 * CONTACT_DEFAULTS.offsetY);
  });

  it("image allongée : l'ombre part du plus petit côté", () => {
    const g = contactShadowGeometry({ width: 100, height: 200 });
    expect(g.width).toBeCloseTo(100 * CONTACT_DEFAULTS.size);
  });

  it("réglages du monde et opacité bornée", () => {
    const g = contactShadowGeometry({ width: 100, height: 100 }, { size: 0.8, opacity: 3 });
    expect(g.width).toBeCloseTo(80);
    expect(g.alpha).toBe(1);
  });
});
