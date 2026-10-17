/**
 * Transition globale du monde et transition de changement de niveau (alpha).
 *
 * Le cœur joue une transition à la fin de `Canvas#draw` (board.mjs:1247, `#animateTransition`) : celle passée dans
 * `canvas._viewOptions.transition` si l'appelant en a fourni une — même sans changement de scène —, sinon celle de la
 * scène si la scène a changé (board.mjs:1271-1274). Un changement de niveau est lui aussi un `Canvas#draw` complet
 * (scene.mjs:275-283), mais sans transition puisque la scène est la même.
 *
 * On intervient donc à `canvasInit` (board.mjs:1168, après le choix de la scène et du niveau, avant
 * `#animateTransition`) : si rien n'est demandé, on pose `_viewOptions.transition`. L'image de départ est déjà
 * capturée (board.mjs:1100), l'image d'arrivée le sera par le cœur. `Scene#view` remet `_viewOptions` à `{}` après le
 * dessin ; un `canvas.draw()` appelé directement ne le fait pas, d'où le nettoyage au `canvasInit` suivant.
 */

import { chooseTransition, transitionKey } from "../core/transitions.mjs";
import { MODULE_ID } from "../settings.mjs";
import { setNextDirection } from "./depth-filter.mjs";
import { levelTransitionEnabled } from "./registry.mjs";

/** Dernière vue dessinée sur ce client. */
let last = { sceneId: null, levelId: null, bottom: null };

/** Options de vue posées par ce module, à retirer si personne ne l'a fait. */
let injected = null;

export function globalTransition() {
  const value = game.settings.get(MODULE_ID, "globalTransition");
  return (value && (typeof value === "object")) ? value : null;
}

function onCanvasInit(board) {
  if ( injected && (board._viewOptions === injected) ) board._viewOptions = {};
  injected = null;

  const scene = board.scene;
  const level = board.level;
  if ( !scene || !level ) return;
  const sceneChanged = scene.id !== last.sceneId;
  const levelChanged = !sceneChanged && (level.id !== last.levelId);
  const fromBottom = last.bottom;
  const toBottom = level.elevation?.bottom ?? null;
  last = { sceneId: scene.id, levelId: level.id, bottom: toBottom };

  const global = globalTransition();
  const choice = chooseTransition({
    explicit: !!board._viewOptions?.transition,
    sceneChanged,
    levelChanged,
    sceneType: scene.transition?.type ?? null,
    global: global?.type ? {
      type: global.type,
      duration: global.duration || CONFIG.Canvas.sceneTransitions[global.type]?.defaultDuration,
      activeOnly: global.activeOnly,
      override: global.override
    } : null,
    level: {
      enabled: levelTransitionEnabled(),
      type: transitionKey("depth"),
      duration: game.settings.get(MODULE_ID, "levelTransitionDuration")
    },
    fromBottom,
    toBottom
  });
  if ( !choice || !(choice.type in CONFIG.Canvas.sceneTransitions) ) return;
  if ( choice.direction ) setNextDirection(choice.direction);
  const transition = { type: choice.type, duration: choice.duration, activeOnly: !!choice.activeOnly };
  injected = board._viewOptions = { ...board._viewOptions, transition };
}

export function registerViewTransitions() {
  Hooks.on("canvasInit", onCanvasInit);
}
