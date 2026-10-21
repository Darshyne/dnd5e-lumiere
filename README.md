# DAS · Shadows & Ambience (`dnd5e-lumiere`)

[![Tests](https://github.com/Darshyne/dnd5e-lumiere/actions/workflows/tests.yml/badge.svg)](https://github.com/Darshyne/dnd5e-lumiere/actions/workflows/tests.yml)

**[Website](https://darshyne.github.io)** · **[Discord](https://discord.gg/PDSq8dYdTP)** (questions, bugs, ideas)

> **Beta.** Darshyne's Automation Suite is still in beta: not every spell and feature is covered yet, and things may change
> between versions. If something doesn't behave as it should, tell us on [Discord](https://discord.gg/PDSq8dYdTP) or
> [open an issue](https://github.com/Darshyne/dnd5e-lumiere/issues).

Part of **Darshyne's Automation Suite (DAS)**. Token visual effects for **Foundry VTT V14** and **dnd5e 6.x**:

- a contact shadow under every token;
- up to two elliptical shadows cast by the scene's lights and by the sun;
- bobbing for flying creatures;
- elevation perspective, specific to each viewer (lower = smaller, higher = larger and semi-transparent);
- blur beyond darkvision range;
- a view from the **Ethereal Plane**: when a token you look from is Ethereal, the Material Plane turns blurred, grey and
  misty, and Ethereal creatures stand out, sharp, with a faint bluish halo;
- custom **scene transitions** (watercolour ink…), a world-wide transition for every scene, and import / export of
  transition presets as JSON.

**Purely visual and local**: nothing is ever written to a token or actor, each client computes its own rendering.
There are no vision or light rules here: those belong to the
[`dnd5e-combat`](https://github.com/Darshyne/dnd5e-combat) engine, which is not required (the only, optional,
link: "is it daylight" is read from its API when it is active). Incompatible with Token Elevation Shadows,
Sprite Shadows and Flying Tokens; compatible with Token Magic FX.

## Scene transitions

The module adds its transitions to Foundry V14's own list (*Scene configuration* → *Transition Animation*, the
*Teleport Token* region behavior, `canvas.transition.run`), prefixed « DAS · »: **Ink (watercolour)**, **Ink (wash
reveal)** and **Blood ink**.

*Configure Settings* → *Shadows & Ambience* → **Transitions** (GM only) opens a window to:

- pick a **world transition**, played when entering any scene that has none of its own (optionally replacing the
  scenes' own transitions, or only when a scene is activated);
- **preview** any transition on the current scene;
- **export** a transition as JSON, and **import** a JSON file of transitions into the world.

A transition file only holds the parameters of one of the module's built-in effects — never code:

```json
{
  "format": "das-transitions",
  "version": 1,
  "transitions": [
    {
      "id": "greenInk",
      "label": { "en": "Green ink", "fr": "Encre verte" },
      "base": "ink",
      "duration": 4000,
      "params": { "ink": "#0b3a12", "reveal": "wash", "grain": 0.4 }
    }
  ]
}
```

`base: "ink"` parameters: `hold` (% of the duration on full ink, 0–60), `drops` (1–6), `stagger` (0–1), `warp` (0–3),
`lobeScale` (0.5–10), `lobeAmt` (0–2), `tendrils` (0–2), `density` (0–1.5), `rim` (0–1), `rimWidth` (0.005–0.5),
`soft` (0.001–0.2), `grain` (0–1), `ink` (`#rrggbb`), `reveal` (`holes` or `wash`), `holes` (1–6). Missing parameters
take their default; out-of-range values are clamped. Importing an `id` that already exists replaces it. Macro API:
`game.modules.get("dnd5e-lumiere").api.transitions` (`list()`, `preview(id)`, `import(data)`, `open()`).

**Level change (alpha, off by default)**: the world setting *Level change transition* plays a depth effect when the
view moves to another level of the same scene — going up, the level left behind shrinks and fades away while the new
one settles from above the screen; going down, the reverse. Experimental.

## Installation

In Foundry (or on The Forge), *Install Module* → paste the manifest URL:

```
https://github.com/Darshyne/dnd5e-lumiere/releases/latest/download/module.json
```

From source: the Foundry module is the `module/` subfolder, to copy or link into `Data/modules/dnd5e-lumiere`.
Tests: `npm install && npm test`.

## Translations

The module ships in English, French and Brazilian Portuguese (pt-BR translation by Henrique, [@henriquebot](https://github.com/henriquebot)). To add a language, copy `module/lang/en.json` to
`module/lang/<code>.json`, translate the values (keep the keys and the `{placeholders}` as they are), and add an
entry to `languages` in `module/module.json`. Any key missing from a translation falls back to English.

## License

Code under the MIT license (see `LICENSE`).

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC,
available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0
International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. This module is not
affiliated with, nor endorsed by, Wizards of the Coast.
