/**
 * Plan Éthéré — la vue depuis l'Éthéré (demande de l'utilisateur, 2026-10-21) : « le plan matériel superposé apparaît monochrome,
 * flou, teinté de nuances de gris » ; les créatures Éthérées s'en détachent, nettes, dans leurs propres couleurs, avec un léger halo
 * bleuté. Les règles (qui est dans l'Éthéré, qui voit qui) sont celles du moteur de combat ; ici, le calcul pur du rendu.
 */

export const ETHEREAL_DEFAULTS = Object.freeze({
  blur: 3,              // rayon du flou du plan matériel, en pixels d'écran
  mist: 0.3,            // part de brume (teinte claire) mêlée au gris, 0–1
  tint: "#a9b7c9",      // la brume : gris bleuté
  halo: 0.5,            // opacité du halo autour d'une créature Éthérée (0 = aucun)
  haloColor: "#8ec5ff", // bleu clair
  haloScale: 1.45       // taille du halo, en multiple du plus grand côté du token
});

/** « #rrggbb » → [r, g, b] entre 0 et 1 ; une couleur illisible donne `fallback`. */
export function rgbOf(hex, fallback=ETHEREAL_DEFAULTS.tint) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if ( !m ) return (hex === fallback) ? [1, 1, 1] : rgbOf(fallback, fallback);
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** La taille du halo d'un token de `width` × `height` pixels. */
export function haloSize(width, height, scale=ETHEREAL_DEFAULTS.haloScale) {
  return Math.max(Math.abs(width), Math.abs(height)) * scale;
}

/** Une valeur de réglage bornée (un réglage absent ou faux garde le défaut). */
export function clamp01(value, fallback) {
  const v = Number(value);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}
