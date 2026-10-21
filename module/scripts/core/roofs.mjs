/**
 * Toits toujours visibles (demande de l'utilisateur, 2026-10-21) : sur les cartes en fausse perspective (DM Andy), toit et fronton
 * sont une seule tuile détourée ; avec la vue bloquée par les murs et le brouillard, les joueurs ne la voient jamais. Une tuile marquée
 * est ajoutée, par sa silhouette, au masque de vision de ce client : le cœur la dessine alors comme vue. Ici, le calcul pur.
 */

/** Le flag de la tuile (`flags.dnd5e-lumiere.alwaysVisibleRoof`). */
export const ROOF_FLAG = "alwaysVisibleRoof";

/** La tuile est-elle marquée « toit toujours visible » ? `flags` = les flags du module sur la tuile. */
export function isMarkedRoof(flags) {
  return flags?.[ROOF_FLAG] === true;
}

/**
 * La part de la silhouette du toit à révéler, 0–1. Rien si la tuile n'est pas affichée sur ce client (cachée, autre niveau) ; rien
 * quand le cœur l'occulte (un token dessous) : sinon l'intérieur, sous le toit estompé, serait révélé à travers le brouillard. Le
 * fondu au survol (`hoverOcclusion`, 0–1) estompe la silhouette avec le toit. Rien non plus quand une surface occultée (plafond de
 * niveau V14 survolé ou au-dessus d'un token) touche la tuile (`surfaceOccluded`) : en mode Surface, le toit s'y efface et laisse voir
 * les niveaux du dessous (vu le 2026-10-21 sur la carte de l'utilisateur, au survol, côté joueur).
 */
export function roofMaskAlpha({ visible=true, occluded=false, surfaceOccluded=false, hoverOcclusion=0, alpha=1 }={}) {
  if ( !visible || occluded || surfaceOccluded ) return 0;
  const hover = Number.isFinite(hoverOcclusion) ? Math.min(Math.max(hoverOcclusion, 0), 1) : 0;
  const a = Number.isFinite(alpha) ? Math.min(Math.max(alpha, 0), 1) : 1;
  return a * (1 - hover);
}

/**
 * Une surface occultée touche-t-elle la tuile ? `surfaces` : `{ elevation, bounds }` des surfaces occultées (bornes = rectangle de leur
 * région) ; `tile` : `{ elevation, bounds }`. Une surface à l'élévation de la tuile ou en dessous l'efface (mode Surface) ; on reste
 * prudent : peu importe le mode de la tuile, elle repasse sous le brouillard le temps de l'occlusion.
 */
export function touchesOccludedSurface(surfaces, tile) {
  const b = tile?.bounds;
  if ( !b ) return false;
  for ( const s of surfaces ?? [] ) {
    const r = s?.bounds;
    if ( !r || !(s.elevation <= tile.elevation) ) continue;
    if ( (r.x < b.x + b.width) && (r.x + r.width > b.x) && (r.y < b.y + b.height) && (r.y + r.height > b.y) ) return true;
  }
  return false;
}

/** Une empreinte de l'état dessiné, pour ne redessiner le masque que quand il change. */
export function roofSignature({ texture="", x=0, y=0, scaleX=1, scaleY=1, anchorX=0, anchorY=0, rotation=0, alpha=0 }={}) {
  const r = n => Math.round(n * 1000) / 1000;
  return [texture, r(x), r(y), r(scaleX), r(scaleY), r(anchorX), r(anchorY), r(rotation), r(alpha)].join("|");
}
