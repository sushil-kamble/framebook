export const ASPECT_RATIOS = new Set(["1:1", "3:4", "4:3", "16:9"])

export const GENERATION_VERSION_COUNTS = new Set([1, 2, 4])

export function isAspectRatio(value) {
  return ASPECT_RATIOS.has(value)
}

export function isGenerationVersionCount(value) {
  return GENERATION_VERSION_COUNTS.has(value)
}
