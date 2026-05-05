export const ASPECT_RATIOS = new Set(["1:1", "3:4", "4:3", "16:9"])

export const GENERATION_VERSION_COUNTS = new Set([1, 2, 4])

export const ENHANCER_MODES = new Set([
  "balanced",
  "storyboard",
  "brand-product",
  "doodle-explainer",
])

export function isAspectRatio(value) {
  return ASPECT_RATIOS.has(value)
}

export function isEnhancerMode(value) {
  return ENHANCER_MODES.has(value)
}

export function isGenerationVersionCount(value) {
  return GENERATION_VERSION_COUNTS.has(value)
}
