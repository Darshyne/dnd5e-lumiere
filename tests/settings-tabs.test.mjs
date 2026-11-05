// Le plan des catégories de réglages range chaque réglage visible du module, une seule fois.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_TABS } from "../module/scripts/core/settings-tabs.mjs";

const scripts = join(import.meta.dirname, "..", "module", "scripts");
const files = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : p.endsWith(".mjs") ? [p] : [];
});

/** Réglages visibles déclarés : `toggle("x"` / `range("x"` (settings.mjs), et `register(MODULE_ID, "x", { … config: true`. */
function visibleSettings() {
  const keys = new Set();
  for ( const p of files(scripts) ) {
    const code = readFileSync(p, "utf8");
    for ( const [, k] of code.matchAll(/\b(?:toggle|range)\("(\w+)"/g) ) keys.add(k);
    for ( const [, k, body] of code.matchAll(/settings\.register\(MODULE_ID, "(\w+)", \{([\s\S]*?)\n\s*\}\);/g) ) {
      if ( /config:\s*true/.test(body) ) keys.add(k);
    }
  }
  return keys;
}

describe("catégories des réglages", () => {
  const placed = SETTINGS_TABS.flatMap(t => t.keys);
  it("chaque réglage n'est rangé qu'une fois", () => {
    expect(new Set(placed).size).toBe(placed.length);
  });
  it("chaque réglage visible est rangé, et rien d'autre", () => {
    expect([...visibleSettings()].sort()).toEqual([...placed].sort());
  });
  it("identifiants d'onglet uniques", () => {
    const ids = SETTINGS_TABS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
