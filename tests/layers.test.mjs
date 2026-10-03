// module/scripts/core/ est du calcul pur (géométrie des ombres, perspective) : il ne doit jamais
// toucher aux globales de Foundry, c'est ce qui le rend testable ici.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CORE = fileURLToPath(new URL("../module/scripts/core/", import.meta.url));
const FORBIDDEN = /\b(game|canvas|Hooks|CONFIG|PIXI|foundry)\b/;

describe("core/ reste pur", () => {
  const files = readdirSync(CORE).filter(f => f.endsWith(".mjs"));
  it.each(files.length ? files : ["(aucun fichier)"])("%s", file => {
    if ( !file.endsWith(".mjs") ) return;
    const code = readFileSync(join(CORE, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(FORBIDDEN);
  });
});
