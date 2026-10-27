/**
 * Tokens qui ne projettent pas d'ombre : ce ne sont pas des créatures debout sur la carte.
 * - un objet du moteur de combat (`flags.dnd5e-combat.object` : piège posé, butin, objet au sol) — le drapeau
 *   générique du moteur, lu sans dépendre de lui ;
 * - un acteur de type de créature « Piège » (pièges du DMG 2024 : PNJ de type personnalisé « Trap »).
 * Calcul pur sur les données du token.
 */

const TRAP_TYPE = /^(traps?|pièges?)$/i;

/**
 * @param {object} doc   Le TokenDocument (ou ses données).
 * @returns {boolean}
 */
export function castsNoShadow(doc) {
  if ( doc?.flags?.["dnd5e-combat"]?.object ) return true;
  const type = doc?.actor?.system?.details?.type;
  return (type?.value === "custom") && TRAP_TYPE.test(String(type.custom ?? "").trim());
}
