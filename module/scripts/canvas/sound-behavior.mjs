/**
 * Comportement de région « Son d'ambiance (DAS) » (étape 13) : le son porté par une zone, déclaré dans module.json
 * (`documentTypes.RegionBehavior.ambientSound`). Il ne réagit à aucun évènement de région : canvas/carried-sounds.mjs le lit sur chaque
 * client. Un nouveau type de comportement demande de **relancer le monde** (le manifeste n'est relu qu'à l'écran de configuration).
 */

import { MODULE_ID } from "../settings.mjs";

export const SOUND_BEHAVIOR = `${MODULE_ID}.ambientSound`;

// Un préfixe de traduction (le cœur y ajoute `FIELDS.<champ>.label`), pas une clé : construit, pour que la garde des traductions
// (tests/i18n.test.mjs) ne le prenne pas pour une clé manquante.
const NS = "DND5E_LUMIERE";

/** La classe de données, construite à `init` (les champs de données n'existent que dans Foundry). */
function behaviorClass() {
  const fields = foundry.data.fields;
  return class AmbientSoundBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
    static LOCALIZATION_PREFIXES = [`${NS}.SoundBehavior`];
    static defineSchema() {
      return {
        idle: new fields.FilePathField({ categories: ["AUDIO"], required: false, blank: true, initial: "" }),
        combat: new fields.FilePathField({ categories: ["AUDIO"], required: false, blank: true, initial: "" }),
        radius: new fields.NumberField({ required: false, nullable: true, min: 0, step: 0.5, initial: null }),
        volume: new fields.AlphaField({ initial: 0.5, step: 0.01 }),
        walls: new fields.BooleanField({ initial: false })
      };
    }
    static events = {};
  };
}

export function registerSoundBehavior() {
  CONFIG.RegionBehavior.dataModels[SOUND_BEHAVIOR] = behaviorClass();
  CONFIG.RegionBehavior.typeIcons[SOUND_BEHAVIOR] = "fa-solid fa-volume-high";
}
