import { describe, it, expect } from "vitest";
import { SOUND_DEFAULTS, clampElevation, nearestPointOnPolygons, pickPath, silenced, soundConfig } from "../module/scripts/core/carried-sound.mjs";

describe("sons portés : réglage, choix du son, silence", () => {
  it("sans aucun son, pas de réglage", () => {
    expect(soundConfig(null, 5)).toBeNull();
    expect(soundConfig({ idle: " ", combat: "" }, 5)).toBeNull();
  });

  it("portée vide = six cases de la scène, volume borné, murs étouffants par défaut", () => {
    expect(soundConfig({ idle: "a.ogg" }, 5)).toEqual({ idle: "a.ogg", combat: "", radius: 30, volume: SOUND_DEFAULTS.volume, walls: false });
    expect(soundConfig({ idle: "a.ogg", radius: "" }, 1.5).radius).toBeCloseTo(9);
    expect(soundConfig({ idle: "a.ogg", volume: 3, walls: true }, 5)).toMatchObject({ volume: 1, walls: true });
    expect(soundConfig({ idle: "a.ogg", radius: 0 }, 5)).toBeNull();
  });

  it("combat : le son de combat s'il existe, sinon celui de repos", () => {
    const both = soundConfig({ idle: "repos.ogg", combat: "combat.ogg" }, 5);
    expect(pickPath(both, false)).toBe("repos.ogg");
    expect(pickPath(both, true)).toBe("combat.ogg");
    expect(pickPath(soundConfig({ idle: "repos.ogg" }, 5), true)).toBe("repos.ogg");
    expect(pickPath(soundConfig({ combat: "combat.ogg" }, 5), false)).toBe("");
  });

  it("silence : masqué, mort, caché, Éthéré entendu du plan matériel", () => {
    expect(silenced({})).toBe(false);
    expect(silenced({ hidden: true })).toBe(true);
    expect(silenced({ dead: true })).toBe(true);
    expect(silenced({ stealth: true })).toBe(true);
    expect(silenced({ ethereal: true })).toBe(true);
    expect(silenced({ ethereal: true, listenerEthereal: true })).toBe(false);
  });
});

describe("sons portés : une zone joue depuis son bord le plus proche", () => {
  const square = [[0, 0, 100, 0, 100, 100, 0, 100]];

  it("point le plus proche du bord, y compris sur le segment qui referme le polygone", () => {
    expect(nearestPointOnPolygons({ x: 150, y: 50 }, square)).toEqual({ x: 100, y: 50 });
    expect(nearestPointOnPolygons({ x: -20, y: 30 }, square)).toEqual({ x: 0, y: 30 });
    expect(nearestPointOnPolygons({ x: 130, y: 140 }, square)).toEqual({ x: 100, y: 100 });
  });

  it("plusieurs formes : la plus proche", () => {
    const two = [...square, [300, 0, 400, 0, 400, 100, 300, 100]];
    expect(nearestPointOnPolygons({ x: 290, y: 50 }, two)).toEqual({ x: 300, y: 50 });
  });

  it("sans forme, rien", () => {
    expect(nearestPointOnPolygons({ x: 0, y: 0 }, [])).toBeNull();
  });

  it("élévation ramenée dans la tranche de la zone", () => {
    expect(clampElevation(30, 0, 10)).toBe(10);
    expect(clampElevation(-5, 0, null)).toBe(0);
    expect(clampElevation(5, -Infinity, Infinity)).toBe(5);
  });
});
