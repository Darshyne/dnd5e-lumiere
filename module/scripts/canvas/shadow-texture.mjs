/**
 * Texture partagée par toutes les ombres : un disque noir à bord fondu, dessiné une seule fois.
 * Chaque ombre est un mesh étiré en ellipse sur cette texture — aucun filtre de flou par token.
 */

const SIZE = 128;
let texture = null;

export function shadowTexture() {
  if ( texture && !texture.baseTexture?.destroyed ) return texture;
  const el = document.createElement("canvas");
  el.width = el.height = SIZE;
  const ctx = el.getContext("2d");
  const r = SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.65, "rgba(0,0,0,0.95)");
  g.addColorStop(0.88, "rgba(0,0,0,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  texture = PIXI.Texture.from(el);
  return texture;
}
