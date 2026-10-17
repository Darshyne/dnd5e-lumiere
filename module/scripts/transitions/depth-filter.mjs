/**
 * Effet de base « Profondeur » (alpha) : changement de niveau dans une même scène.
 *
 * En montant, le plan quitté rétrécit et s'éloigne vers le bas en s'assombrissant et en se floutant, pendant que le
 * plan rejoint arrive « par-dessus l'écran » : d'abord plus grand, flou et transparent, il se pose à sa taille. En
 * descendant, l'inverse : le plan quitté grossit et passe derrière la caméra, le nouveau monte du fond.
 *
 * Les deux images sont celles que le cœur capture (client/canvas/transition.mjs) : rendues avec la vision et le
 * brouillard de ce client, elles ne montrent donc rien de caché. Le zoom est centré sur le token contrôlé.
 */

import { resolveParams } from "../core/transitions.mjs";

const TextureTransitionFilter = foundry.canvas.rendering.filters.TextureTransitionFilter;

/** Sens du prochain changement de niveau, posé par transitions/view.mjs juste avant le dessin du canvas. */
let nextDirection = null;

/** @param {"up"|"down"} direction */
export function setNextDirection(direction) {
  nextDirection = direction;
}

export default class DepthTransitionFilter extends TextureTransitionFilter {

  #key = null;

  /** @override */
  get type() {
    return this.#key;
  }

  /** @override */
  set type(value) {
    this.#key = value;
  }

  /** @override */
  set targetTexture(texture) {
    super.targetTexture = texture;
    const params = resolveParams("depth", CONFIG.Canvas.sceneTransitions[this.#key]?.params);
    const direction = nextDirection ?? params.direction;
    nextDirection = null;
    Object.assign(this.uniforms, {
      uDir: direction === "down" ? -1 : 1,
      uZoom: params.zoom,
      uBlur: params.blur,
      uDim: params.dim,
      uGhost: params.ghost,
      uAnchor: DepthTransitionFilter.#anchor()
    });
  }

  /** Centre du zoom, en coordonnées d'écran 0-1 : le token contrôlé s'il est à l'écran, sinon le centre. */
  static #anchor() {
    const token = canvas.tokens?.controlled[0];
    const { width, height } = canvas.app.renderer.screen;
    if ( !token || !width || !height ) return [0.5, 0.5];
    const p = canvas.stage.worldTransform.apply(token.center);
    const x = p.x / width;
    const y = p.y / height;
    if ( (x < 0) || (x > 1) || (y < 0) || (y > 1) ) return [0.5, 0.5];
    return [x, y];
  }

  /** @override */
  static get defaultUniforms() {
    const params = resolveParams("depth");
    return {
      ...super.defaultUniforms,
      uDir: 1,
      uZoom: params.zoom,
      uBlur: params.blur,
      uDim: params.dim,
      uGhost: params.ghost,
      uAnchor: [0.5, 0.5],
      uTexel: [1 / 1920, 1 / 1080]
    };
  }

  /** @override */
  apply(filterManager, input, output, clear) {
    const { width, height } = canvas.app.renderer.screen;
    this.uniforms.uTexel = [1 / Math.max(width, 1), 1 / Math.max(height, 1)];
    super.apply(filterManager, input, output, clear);
  }

  /** @override */
  static _createFragmentShader() {
    return `
    precision ${PIXI.Program.defaultFragmentPrecision} float;

    uniform sampler2D uSampler;
    uniform sampler2D targetTexture;
    uniform mat3 targetUVMatrix;
    uniform mat3 filterMatrixInverse;
    uniform float progress;
    uniform vec4 tintAlpha;

    uniform float uDir;
    uniform float uZoom;
    uniform float uBlur;
    uniform float uDim;
    uniform float uGhost;
    uniform vec2 uAnchor;
    uniform vec2 uTexel;

    varying vec2 vTextureCoord;
    varying vec2 vFilterCoord;

    float clip(in vec2 uv) {
      return step(3.5, step(0.0, uv.x) + step(0.0, uv.y) + step(uv.x, 1.0) + step(uv.y, 1.0));
    }

    vec4 fromOld(in vec2 uv) {
      return texture2D(uSampler, (filterMatrixInverse * vec3(uv, 1.0)).xy) * clip(uv);
    }

    vec4 fromNew(in vec2 uv) {
      return texture2D(targetTexture, (targetUVMatrix * vec3(uv, 1.0)).xy) * clip(uv);
    }

    // Flou de profondeur : 9 prises en croix et en diagonale, rayon en pixels d'écran
    vec4 blurOld(in vec2 uv, in float radius) {
      if ( radius < 0.25 ) return fromOld(uv);
      vec2 d = uTexel * radius;
      vec4 c = fromOld(uv) * 0.2;
      c += (fromOld(uv + vec2(d.x, 0.0)) + fromOld(uv - vec2(d.x, 0.0))
          + fromOld(uv + vec2(0.0, d.y)) + fromOld(uv - vec2(0.0, d.y))) * 0.12;
      c += (fromOld(uv + d) + fromOld(uv - d)
          + fromOld(uv + vec2(d.x, -d.y)) + fromOld(uv - vec2(d.x, -d.y))) * 0.08;
      return c;
    }

    vec4 blurNew(in vec2 uv, in float radius) {
      if ( radius < 0.25 ) return fromNew(uv);
      vec2 d = uTexel * radius;
      vec4 c = fromNew(uv) * 0.2;
      c += (fromNew(uv + vec2(d.x, 0.0)) + fromNew(uv - vec2(d.x, 0.0))
          + fromNew(uv + vec2(0.0, d.y)) + fromNew(uv - vec2(0.0, d.y))) * 0.12;
      c += (fromNew(uv + d) + fromNew(uv - d)
          + fromNew(uv + vec2(d.x, -d.y)) + fromNew(uv - vec2(d.x, -d.y))) * 0.08;
      return c;
    }

    void main() {
      vec2 uv = vFilterCoord;
      float p = clamp(progress, 0.0, 1.0);
      float e = p * p * (3.0 - 2.0 * p);

      // Fenêtres : l'ancien plan s'efface jusqu'à mi-course (+ chevauchement), le nouveau apparaît à partir de
      // mi-course (− chevauchement)
      float lap = uGhost * 0.5;
      float oldEnd = 0.5 + lap;
      float newStart = 0.5 - lap;
      float aOld = 1.0 - smoothstep(0.0, oldEnd, p);
      float aNew = smoothstep(newStart, min(1.0, newStart + 0.55), p);

      // En montant (uDir = 1) : l'ancien rétrécit, le nouveau arrive plus grand ; en descendant, l'inverse
      float sOld = max(0.05, 1.0 - uDir * uZoom * e);
      float sNew = max(0.05, 1.0 + uDir * uZoom * (1.0 - e));
      vec2 uvOld = uAnchor + (uv - uAnchor) / sOld;
      vec2 uvNew = uAnchor + (uv - uAnchor) / sNew;

      float leave = smoothstep(0.0, oldEnd, p);
      vec4 cOld = blurOld(uvOld, uBlur * 8.0 * leave);
      cOld.rgb *= 1.0 - uDim * leave;

      vec4 cNew = blurNew(uvNew, uBlur * 8.0 * (1.0 - aNew));

      vec3 col = mix(cOld.rgb * aOld, cNew.rgb, aNew);
      gl_FragColor = vec4(col, 1.0) * tintAlpha;
    }
    `;
  }
}
