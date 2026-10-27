/**
 * Tokens qui ne projettent pas d'ombre : ce ne sont pas des créatures debout sur la carte.
 * - un objet du moteur de combat (`flags.dnd5e-combat.object` : piège posé, butin, objet au sol) — le drapeau
 *   générique du moteur, lu sans dépendre de lui ;
 * - un acteur de type de créature « Piège » (pièges du DMG 2024 : PNJ de type personnalisé « Trap ») ;
 * - un acteur Groupe qui n'est ni un groupe de personnages ni une rencontre : un trésor, un coffre (contenu d'un
 *   conteneur de DAS · Loot, butin converti).
 * Calcul pur sur les données du token.
 */

const TRAP_TYPE = /^(traps?|pièges?)$/i;

/** Types de groupe dnd5e (`CONFIG.DND5E.groupTypes`) dont le token représente des créatures. */
const CREATURE_GROUPS = new Set(["party", "encounter"]);

/**
 * @param {object} doc   Le TokenDocument (ou ses données).
 * @returns {boolean}
 */
export function castsNoShadow(doc) {
  if ( doc?.flags?.["dnd5e-combat"]?.object ) return true;
  if ( doc?.actor?.type === "group" ) return !CREATURE_GROUPS.has(doc.actor.system?.type?.value);
  const type = doc?.actor?.system?.details?.type;
  return (type?.value === "custom") && TRAP_TYPE.test(String(type.custom ?? "").trim());
}
