import { describe, expect, it } from "vitest";
import { castsNoShadow } from "../module/scripts/core/shadowless.mjs";

const npc = type => ({ actor: { system: { details: { type } } } });

describe("castsNoShadow", () => {
  it("un objet du moteur n'a pas d'ombre", () => {
    expect(castsNoShadow({ flags: { "dnd5e-combat": { object: true } } })).toBe(true);
  });

  it("un piège du DMG (type personnalisé « Trap ») n'a pas d'ombre", () => {
    expect(castsNoShadow(npc({ value: "custom", custom: "Trap" }))).toBe(true);
    expect(castsNoShadow(npc({ value: "custom", custom: " piège " }))).toBe(true);
  });

  it("un trésor (acteur Groupe sans type) n'a pas d'ombre, un groupe de personnages ou une rencontre si", () => {
    const group = value => ({ actor: { type: "group", system: { type: { value } } } });
    expect(castsNoShadow(group(""))).toBe(true);
    expect(castsNoShadow(group(undefined))).toBe(true);
    expect(castsNoShadow(group("party"))).toBe(false);
    expect(castsNoShadow(group("encounter"))).toBe(false);
  });

  it("une créature ordinaire garde son ombre", () => {
    expect(castsNoShadow(npc({ value: "humanoid" }))).toBe(false);
    expect(castsNoShadow(npc({ value: "custom", custom: "Trapper" }))).toBe(false);
    expect(castsNoShadow({ flags: {} })).toBe(false);
    expect(castsNoShadow(null)).toBe(false);
  });
});
