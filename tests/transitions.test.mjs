import { describe, expect, it } from "vitest";
import {
  BASES, BUILT_IN, FILE_FORMAT, chooseTransition, exportTransitionFile, mergeTransitions, parseTransitionFile,
  pickLabel, resolveParams, transitionKey
} from "../module/scripts/core/transitions.mjs";

describe("resolveParams", () => {
  it("donne les défauts de l'effet", () => {
    const p = resolveParams("ink");
    expect(p.drops).toBe(5);
    expect(p.ink).toBe("#0b0b10");
    expect(Object.keys(p).sort()).toEqual(Object.keys(BASES.ink.params).sort());
  });

  it("borne, arrondit, refuse et signale", () => {
    const warnings = [];
    const p = resolveParams("ink", { drops: 9.4, hold: -3, ink: "red", reveal: "wash", foo: 1, rim: "x" }, warnings);
    expect(p.drops).toBe(6);
    expect(p.hold).toBe(0);
    expect(p.ink).toBe("#0b0b10");
    expect(p.reveal).toBe("wash");
    expect(p.rim).toBe(0.65);
    expect(p).not.toHaveProperty("foo");
    expect(warnings.length).toBe(5);
  });

  it("accepte une couleur et la met en minuscules", () => {
    expect(resolveParams("ink", { ink: "#3A0000" }).ink).toBe("#3a0000");
  });
});

describe("pickLabel", () => {
  it("chaîne, langue, langue de base, anglais, première venue", () => {
    expect(pickLabel("Encre")).toBe("Encre");
    expect(pickLabel({ en: "Ink", fr: "Encre" }, "fr")).toBe("Encre");
    expect(pickLabel({ en: "Ink", pt: "Tinta" }, "pt-BR")).toBe("Tinta");
    expect(pickLabel({ en: "Ink" }, "de")).toBe("Ink");
    expect(pickLabel({ de: "Tinte" }, "fr")).toBe("Tinte");
    expect(pickLabel(null)).toBe("");
  });
});

describe("parseTransitionFile", () => {
  const entry = { id: "inkGreen", label: { en: "Green ink", fr: "Encre verte" }, base: "ink", duration: 3333,
    params: { ink: "#004400" } };

  it("lit le format complet, un tableau ou une seule entrée", () => {
    for ( const data of [{ format: FILE_FORMAT, version: 1, transitions: [entry] }, [entry], entry] ) {
      const { transitions, errors } = parseTransitionFile(data);
      expect(errors).toEqual([]);
      expect(transitions).toHaveLength(1);
      expect(transitions[0].duration).toBe(3300);
      expect(transitions[0].params.ink).toBe("#004400");
      expect(transitions[0].params.drops).toBe(5);
    }
  });

  it("refuse un autre format, un id invalide, un id livré, un doublon, un effet inconnu, un libellé vide", () => {
    expect(parseTransitionFile({ format: "autre", transitions: [entry] }).errors).toHaveLength(1);
    const { transitions, errors } = parseTransitionFile([
      { ...entry, id: "1abc" },
      { ...entry, id: "ink" },
      entry,
      { ...entry },
      { ...entry, id: "shader", base: "glsl" },
      { ...entry, id: "noLabel", label: "  " },
      "texte"
    ]);
    expect(transitions.map(t => t.id)).toEqual(["inkGreen"]);
    expect(errors).toHaveLength(6);
  });

  it("borne la durée entre 500 et 10000 ms", () => {
    expect(parseTransitionFile({ ...entry, duration: 50 }).transitions[0].duration).toBe(500);
    expect(parseTransitionFile({ ...entry, duration: 99999 }).transitions[0].duration).toBe(10000);
    expect(parseTransitionFile({ ...entry, duration: undefined }).transitions[0].duration).toBe(BASES.ink.duration);
  });

  it("rien de lisible", () => {
    expect(parseTransitionFile(42).errors).toEqual(["no transitions found"]);
  });

  it("l'export se relit à l'identique, sans les paramètres par défaut", () => {
    const { transitions } = parseTransitionFile(entry);
    const file = exportTransitionFile(transitions);
    expect(file.transitions[0].params).toEqual({ ink: "#004400" });
    expect(parseTransitionFile(JSON.parse(JSON.stringify(file))).transitions).toEqual(transitions);
  });
});

describe("mergeTransitions", () => {
  it("même id remplacé, nouveau ajouté", () => {
    const a = { id: "a", n: 1 };
    const { list, added, replaced } = mergeTransitions([a, { id: "b" }], [{ id: "a", n: 2 }, { id: "c" }]);
    expect(list.map(t => t.id)).toEqual(["a", "b", "c"]);
    expect(list[0].n).toBe(2);
    expect([added, replaced]).toEqual([1, 1]);
  });
});

describe("transitions livrées", () => {
  it("chacune a un effet connu et des paramètres valides", () => {
    for ( const def of Object.values(BUILT_IN) ) {
      const warnings = [];
      resolveParams(def.base, def.params, warnings);
      expect(def.base in BASES).toBe(true);
      expect(warnings).toEqual([]);
    }
  });
  it("clés préfixées", () => {
    expect(transitionKey("ink")).toBe("das-ink");
  });
});

describe("chooseTransition", () => {
  const global = { type: "das-ink", duration: 4500, activeOnly: false, override: false };
  const level = { enabled: true, type: "das-depth", duration: 1100 };
  const base = { explicit: false, sceneChanged: false, levelChanged: false, sceneType: null, global, level,
    fromBottom: 0, toBottom: 10 };

  it("changement de scène sans transition propre : la globale", () => {
    expect(chooseTransition({ ...base, sceneChanged: true }))
      .toEqual({ type: "das-ink", duration: 4500, activeOnly: false });
  });

  it("la scène a sa transition : rien, sauf si la globale la remplace", () => {
    expect(chooseTransition({ ...base, sceneChanged: true, sceneType: "fade" })).toBeNull();
    expect(chooseTransition({ ...base, sceneChanged: true, sceneType: "fade", global: { ...global, override: true } }).type)
      .toBe("das-ink");
  });

  it("pas de globale, ou transition déjà demandée : rien", () => {
    expect(chooseTransition({ ...base, sceneChanged: true, global: null })).toBeNull();
    expect(chooseTransition({ ...base, sceneChanged: true, explicit: true })).toBeNull();
    expect(chooseTransition({ ...base, levelChanged: true, explicit: true })).toBeNull();
  });

  it("changement de niveau : profondeur montante ou descendante", () => {
    expect(chooseTransition({ ...base, levelChanged: true }))
      .toEqual({ type: "das-depth", duration: 1100, direction: "up" });
    expect(chooseTransition({ ...base, levelChanged: true, fromBottom: 10, toBottom: 0 }).direction).toBe("down");
    expect(chooseTransition({ ...base, levelChanged: true, fromBottom: 0, toBottom: null }).direction).toBe("down");
  });

  it("niveau : option coupée ou même hauteur : rien", () => {
    expect(chooseTransition({ ...base, levelChanged: true, level: { ...level, enabled: false } })).toBeNull();
    expect(chooseTransition({ ...base, levelChanged: true, toBottom: 0 })).toBeNull();
  });

  it("même vue redessinée : rien", () => {
    expect(chooseTransition(base)).toBeNull();
  });
});
