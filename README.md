# darsh-dnd · Ombres et ambiance (`dnd5e-lumiere`)

Effets visuels de tokens pour **Foundry VTT V14** et **dnd5e 6.x** :

- ombre de contact sous chaque token ;
- jusqu'à deux ombres elliptiques portées par les lumières de la scène et par le soleil ;
- flottement des créatures en vol ;
- perspective selon l'élévation, propre à chaque spectateur (plus bas = plus petit, plus haut = plus grand et
  semi-transparent) ;
- flou au-delà de la vision dans le noir.

**Purement visuel et local** : rien n'est jamais écrit dans un document, chaque client calcule son propre
rendu. Aucune règle de vision ou de lumière ici : elles appartiennent au moteur
[`dnd5e-combat`](https://github.com/Darshyne/dnd5e-combat), qui n'est pas requis (seul lien, facultatif :
le « plein jour » lu dans son API quand il est actif). Incompatible avec Token Elevation Shadows, Sprite
Shadows et Flying Tokens ; compatible avec Token Magic FX.

## Installation

Dans Foundry (ou sur The Forge), *Installer un module* → coller l'URL de manifeste :

```
https://github.com/Darshyne/dnd5e-lumiere/releases/latest/download/module.json
```

Depuis les sources : le module Foundry est le
sous-dossier `module/`, à copier ou lier dans `Data/modules/dnd5e-lumiere`. Tests : `npm install && npm test`.

## Licence

Code sous licence MIT (voir `LICENSE`).

Ce travail inclut des éléments du System Reference Document 5.2 (« SRD 5.2 ») de Wizards of the Coast LLC,
disponible sur https://www.dndbeyond.com/srd. Le SRD 5.2 est sous licence Creative Commons Attribution 4.0
International, disponible sur https://creativecommons.org/licenses/by/4.0/legalcode. Ce module n'est ni
affilié à Wizards of the Coast ni approuvé par elle.
