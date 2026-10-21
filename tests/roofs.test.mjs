import { describe, it, expect } from "vitest";
import { ROOF_FLAG, isMarkedRoof, roofMaskAlpha, roofSignature } from "../module/scripts/core/roofs.mjs";

describe("toits toujours visibles", () => {
  it("seule une case cochée marque la tuile", () => {
    expect(isMarkedRoof({ [ROOF_FLAG]: true })).toBe(true);
    expect(isMarkedRoof({ [ROOF_FLAG]: false })).toBe(false);
    expect(isMarkedRoof({ [ROOF_FLAG]: "true" })).toBe(false);
    expect(isMarkedRoof(undefined)).toBe(false);
  });

  it("silhouette pleine par défaut, rien si la tuile n'est pas affichée ou si un token est dessous", () => {
    expect(roofMaskAlpha()).toBe(1);
    expect(roofMaskAlpha({ visible: false })).toBe(0);
    expect(roofMaskAlpha({ occluded: true })).toBe(0);
  });

  it("le fondu au survol et l'opacité de la tuile estompent la silhouette, bornés", () => {
    expect(roofMaskAlpha({ hoverOcclusion: 0.25 })).toBe(0.75);
    expect(roofMaskAlpha({ hoverOcclusion: 2 })).toBe(0);
    expect(roofMaskAlpha({ hoverOcclusion: Number.NaN })).toBe(1);
    expect(roofMaskAlpha({ alpha: 0.5, hoverOcclusion: 0.5 })).toBe(0.25);
  });

  it("l'empreinte ne change qu'avec l'état dessiné", () => {
    const a = roofSignature({ texture: "t", x: 10, y: 20, alpha: 1 });
    expect(roofSignature({ texture: "t", x: 10.0001, y: 20, alpha: 1 })).toBe(a);
    expect(roofSignature({ texture: "t", x: 11, y: 20, alpha: 1 })).not.toBe(a);
    expect(roofSignature({ texture: "t", x: 10, y: 20, alpha: 0 })).not.toBe(a);
  });
});
