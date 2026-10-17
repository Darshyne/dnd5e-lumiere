/**
 * Effet de base « Encre » : une tache d'aquarelle envahit la scène de départ jusqu'au noir complet (phase 1),
 * tient, puis se retire sur la scène d'arrivée (phase 2). Repris du module Transition Encre (Call of Cthulhu).
 *
 * Branché sur la chaîne de transitions du cœur V14 (client/canvas/transition.mjs) : `TransitionContainer` rend
 * l'ancienne scène dans un sprite plein écran (`uSampler`), capture la nouvelle (`targetTexture`) et anime
 * `uniforms.progress` de 0 à 1. Le reste est procédural, dans le shader.
 *
 * Une même instance sert à toutes les transitions de cette classe : le cœur lui passe la clé choisie par
 * `filter.type = filterType` (transition.mjs:369), puis la nouvelle scène par `targetTexture` ; c'est là qu'on lit les
 * paramètres de cette transition dans `CONFIG.Canvas.sceneTransitions`.
 */

import { resolveParams } from "../core/transitions.mjs";

const TextureTransitionFilter = foundry.canvas.rendering.filters.TextureTransitionFilter;

/** Graine 0-100 stable tirée d'une chaîne : tous les clients dessinent la même tache pour une scène donnée. */
function seedFrom(text = "") {
  let h = 0;
  for ( const ch of text ) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 10;
}

function paramsToUniforms(params) {
  const ink = foundry.utils.Color.from(params.ink);
  return {
    uHold: params.hold / 100,
    uDropCount: params.drops,
    uStagger: params.stagger,
    uWarp: params.warp,
    uLobeScale: params.lobeScale,
    uLobeAmt: params.lobeAmt,
    uTendrils: params.tendrils,
    uDensity: params.density,
    uRim: params.rim,
    uRimWidth: params.rimWidth,
    uSoft: params.soft,
    uGrain: params.grain,
    uInk: [ink.r, ink.g, ink.b],
    uReveal: params.reveal === "wash" ? 1 : 0,
    uHoleCount: params.holes
  };
}

export default class InkTransitionFilter extends TextureTransitionFilter {

  /** Clé de la transition jouée (`das-ink`, `das-<id importé>`…). */
  #key = null;

  /** @override */
  get type() {
    return this.#key;
  }

  /** @override  Le cœur y passe le `filterType` de la définition : ici, la clé de la transition. */
  set type(value) {
    this.#key = value;
  }

  /** @override  Appelé par le cœur une fois la nouvelle scène capturée, au début de chaque transition. */
  set targetTexture(texture) {
    super.targetTexture = texture;
    const params = resolveParams("ink", CONFIG.Canvas.sceneTransitions[this.#key]?.params);
    Object.assign(this.uniforms, paramsToUniforms(params));
    this.uniforms.uSeed = seedFrom(canvas.scene?.id);
  }

  /** @override */
  static get defaultUniforms() {
    return {
      ...super.defaultUniforms,
      ...paramsToUniforms(resolveParams("ink")),
      uSeed: 0,
      uAspect: 16 / 9,
      uRes: [1920, 1080]
    };
  }

  /** @override */
  apply(filterManager, input, output, clear) {
    const renderer = canvas.app.renderer;
    const { width, height } = renderer.screen;
    this.uniforms.uAspect = width / Math.max(height, 1);
    this.uniforms.uRes = [width * renderer.resolution, height * renderer.resolution];
    super.apply(filterManager, input, output, clear);
  }

  /** @override */
  static _createFragmentShader() {
    return `
    precision ${PIXI.Program.defaultFragmentPrecision} float;

    uniform sampler2D uSampler;
    uniform sampler2D targetTexture;
    uniform mat3 targetUVMatrix;
    uniform float progress;
    uniform vec4 tintAlpha;

    uniform vec2 uRes;
    uniform float uAspect;
    uniform float uSeed;
    uniform float uHold;
    uniform float uDropCount;
    uniform float uStagger;
    uniform float uHoleCount;
    uniform float uReveal;
    uniform float uWarp;
    uniform float uLobeScale;
    uniform float uLobeAmt;
    uniform float uTendrils;
    uniform float uDensity;
    uniform float uRim;
    uniform float uRimWidth;
    uniform float uSoft;
    uniform float uGrain;
    uniform vec3 uInk;

    varying vec2 vTextureCoord;
    varying vec2 vFilterCoord;

    vec4 colorFromSource() {
      return texture2D(uSampler, vTextureCoord);
    }

    vec4 colorFromTarget(in vec2 uv) {
      float clip = step(3.5, step(0.0, uv.x) + step(0.0, uv.y) + step(uv.x, 1.0) + step(uv.y, 1.0));
      return texture2D(targetTexture, (targetUVMatrix * vec3(uv, 1.0)).xy) * clip;
    }

    float rnd(float n) {
      return fract(sin(n * 12.9898 + uSeed * 78.233) * 43758.5453);
    }

    vec2 hash2(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    // Gradient noise, roughly in [-0.7, 0.7]
    float gnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      float a = dot(hash2(i), f);
      float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
      float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
      float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float s = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) {
        s += a * gnoise(p);
        p = m * p + vec2(3.1, 1.7);
        a *= 0.5;
      }
      return s;
    }

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    // Fast at first, then slower: ink drinking the paper
    float growth(float x) {
      x = clamp(x, 0.0, 1.0);
      return 1.0 - pow(1.0 - x, 2.4);
    }

    // Drop i: xy = centre, z = start time. The first drop starts at once, near the centre.
    vec3 dropAt(float i, float salt, float stagger) {
      float b = i * 3.0 + salt * 17.0;
      float first = step(i, 0.5);
      float sx = mix(0.84, 0.5, first);
      float sy = mix(0.76, 0.4, first);
      return vec3((rnd(b + 1.0) - 0.5) * sx * uAspect,
                  (rnd(b + 2.0) - 0.5) * sy,
                  (1.0 - first) * rnd(b + 3.0) * stagger);
    }

    // Signed distance to one growing drop (negative inside)
    float dropSDF(vec2 q, vec3 d, float t, float salt, vec2 seedOff) {
      float x = clamp((t - d.z) / max(1.0 - d.z, 0.001), 0.0, 1.0);
      if (x <= 0.0) return 10.0;
      float r = 2.3 * growth(x);
      float lobe = fbm(q * uLobeScale + seedOff + salt * 7.31);
      float rr = r * max(0.3, 1.0 + uLobeAmt * 1.6 * lobe);
      return length(q - d.xy) - rr;
    }

    void main() {
      vec2 uv = vFilterCoord;
      vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
      vec2 seedOff = vec2(uSeed * 0.37, uSeed * 0.61);

      float span = (1.0 - uHold) * 0.5;
      float t1 = clamp(progress / span, 0.0, 1.0);
      float t2 = clamp((progress - span - uHold) / span, 0.0, 1.0);

      // Paper granulation, in screen pixels
      vec2 fc = uv * uRes;
      float grain = clamp(0.5 + 0.8 * gnoise(fc * 0.45) + 0.6 * gnoise(fc * 0.09), 0.0, 1.0);

      // Domain warp: bends the stain into lobes and fingers, drifting slightly like wet ink
      vec2 wp = p * 1.3 + seedOff;
      vec2 w = vec2(fbm(wp + vec2(0.0, progress * 0.25)), fbm(wp + vec2(5.2, 1.3) - vec2(progress * 0.2, 0.0)));
      vec2 q = p + uWarp * 0.35 * w;

      float flow = clamp(fbm(q * 3.0 + seedOff + 11.0) + 0.5, 0.0, 1.0);
      float ragged = (grain - 0.5) * uGrain * 0.03 + gnoise(q * 40.0) * 0.01;
      vec3 col;

      if (progress <= span + uHold * 0.5) {
        // Phase 1: ink spreads over the previous scene
        float s = 10.0;
        for (int i = 0; i < 6; i++) {
          if (float(i) >= uDropCount) break;
          s = smin(s, dropSDF(q, dropAt(float(i), 1.0, uStagger), t1, float(i), seedOff), 0.06);
        }
        float se = s + ragged;
        float inside = 1.0 - smoothstep(-uSoft, uSoft, se);

        float saturate1 = smoothstep(0.55, 1.0, t1);
        float rim = exp(min(se, 0.0) / max(uRimWidth, 0.001)) * inside;
        float dens = uDensity * mix(0.8, 1.1, flow);
        dens = mix(dens, 1.0, rim * uRim);
        dens *= 1.0 - uGrain * 0.35 * (1.0 - grain) * (1.0 - saturate1);
        dens = mix(dens, 1.0, saturate1);

        float ridge = pow(max(0.0, 1.0 - abs(gnoise(q * 9.0 + seedOff + 23.0)) * 3.2), 6.0);
        float sparse = smoothstep(0.05, 0.35, fbm(q * 2.2 + seedOff + 41.0));
        float tend = ridge * sparse * exp(-max(se, 0.0) / 0.07) * step(0.0, se) * uTendrils;

        float halo = step(0.0, se) * exp(-se / 0.04) * 0.18 * (1.0 - t1 * t1);
        float alpha = clamp(inside * dens + tend * 0.85, 0.0, 1.0);
        alpha = mix(alpha, 1.0, smoothstep(0.88, 1.0, t1));

        vec3 base = colorFromSource().rgb * (1.0 - halo);
        col = mix(base, uInk, alpha);
      } else {
        // Phase 2: ink withdraws from the next scene
        vec2 q2 = p + uWarp * 0.35 * w.yx;
        float se2;
        if (uReveal < 0.5) {
          float s2 = 10.0;
          for (int i = 0; i < 6; i++) {
            if (float(i) >= uHoleCount) break;
            s2 = smin(s2, dropSDF(q2, dropAt(float(i), 2.0, 0.35), t2, float(i) + 7.0, seedOff), 0.06);
          }
          se2 = s2 - ragged;
        } else {
          float field = fbm(q2 * 2.2 + seedOff + 31.0) * 0.9 + (grain - 0.5) * uGrain * 0.12;
          float thr = mix(-0.9, 0.8, growth(t2));
          se2 = (field - thr) / 1.5 - ragged;
        }
        float revealed = 1.0 - smoothstep(-uSoft, uSoft, se2);
        float inkSide = 1.0 - revealed;

        float rim2 = exp(-max(se2, 0.0) / max(uRimWidth, 0.001)) * inkSide;
        float dens2 = mix(1.0, uDensity * mix(0.8, 1.1, flow), smoothstep(0.0, 0.6, t2));
        dens2 = mix(dens2, 1.0, rim2 * uRim);
        dens2 *= 1.0 - uGrain * 0.35 * (1.0 - grain) * smoothstep(0.0, 0.3, t2);

        float alpha2 = inkSide * dens2;
        // Pigment residue just inside the cleared area (watercolour backrun)
        alpha2 += revealed * exp(min(se2, 0.0) / max(uRimWidth * 1.5, 0.001)) * 0.25 * uRim * (1.0 - t2);
        alpha2 *= 1.0 - smoothstep(0.85, 1.0, t2);

        col = mix(colorFromTarget(uv).rgb, uInk, clamp(alpha2, 0.0, 1.0));
      }

      gl_FragColor = vec4(col, 1.0) * tintAlpha;
    }
    `;
  }
}
