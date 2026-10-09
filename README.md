# DAS · Shadows & Ambience (`dnd5e-lumiere`)

[![Tests](https://github.com/Darshyne/dnd5e-lumiere/actions/workflows/tests.yml/badge.svg)](https://github.com/Darshyne/dnd5e-lumiere/actions/workflows/tests.yml)

Part of **Darshyne's Automation Suite (DAS)**. Token visual effects for **Foundry VTT V14** and **dnd5e 6.x**:

- a contact shadow under every token;
- up to two elliptical shadows cast by the scene's lights and by the sun;
- bobbing for flying creatures;
- elevation perspective, specific to each viewer (lower = smaller, higher = larger and semi-transparent);
- blur beyond darkvision range.

**Purely visual and local**: nothing is ever written to a document, each client computes its own rendering.
There are no vision or light rules here: those belong to the
[`dnd5e-combat`](https://github.com/Darshyne/dnd5e-combat) engine, which is not required (the only, optional,
link: "is it daylight" is read from its API when it is active). Incompatible with Token Elevation Shadows,
Sprite Shadows and Flying Tokens; compatible with Token Magic FX.

## Installation

In Foundry (or on The Forge), *Install Module* → paste the manifest URL:

```
https://github.com/Darshyne/dnd5e-lumiere/releases/latest/download/module.json
```

From source: the Foundry module is the `module/` subfolder, to copy or link into `Data/modules/dnd5e-lumiere`.
Tests: `npm install && npm test`.

## Translations

The module ships in English and French. To add a language, copy `module/lang/en.json` to
`module/lang/<code>.json`, translate the values (keep the keys and the `{placeholders}` as they are), and add an
entry to `languages` in `module/module.json`. Any key missing from a translation falls back to English.

## License

Code under the MIT license (see `LICENSE`).

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC,
available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0
International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. This module is not
affiliated with, nor endorsed by, Wizards of the Coast.
