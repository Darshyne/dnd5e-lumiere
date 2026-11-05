/**
 * Le plan de la fenêtre de réglages de Shadows & Ambience (ui/settings-window.mjs) : catégories, réglages rangés, outils. Pur.
 * La fenêtre est celle de la suite DAS (`api.settings.registerWindow` de DAS · Core) ; sans DAS · Core, les réglages restent dans
 * la liste de Foundry.
 */

export const SETTINGS_TABS = Object.freeze([
  { id: "shadows", icon: "fa-solid fa-circle-half-stroke",
    keys: ["contactShadow", "contactSize", "contactOpacity", "lightShadows", "castIntensity", "lightHeight", "castMaxLength",
      "castFlicker", "sunShadows", "sunAltitude"] },
  { id: "movement", icon: "fa-solid fa-person-walking-arrow-right",
    keys: ["flipTokens", "hover", "hoverLift", "hoverAmplitude", "jump", "jumpHeight", "perspective", "elevationLift",
      "perspectiveMax", "fadeAlpha"] },
  { id: "vision", icon: "fa-solid fa-eye",
    keys: ["darkvisionBlur", "darkvisionBlurStrength", "etherealView", "etherealBlur", "etherealMist", "etherealHalo",
      "etherealHaloColor"] },
  { id: "sounds", icon: "fa-solid fa-volume-high", keys: ["carriedSounds"] },
  { id: "transitions", icon: "fa-solid fa-film", keys: ["levelTransition", "levelTransitionDuration"],
    tools: [{ id: "transitions", icon: "fa-solid fa-film" }] }
]);
