import type {
  AspectRatio,
  EnhancerMode,
  GenerationVersionCount,
} from "@framebook/shared/contracts/framebook"

export const aspectRatioOptions: Array<{
  value: AspectRatio
  label: string
  description: string
}> = [
  { value: "1:1", label: "1:1", description: "Square" },
  { value: "3:4", label: "3:4", description: "Portrait" },
  { value: "4:3", label: "4:3", description: "Landscape" },
  { value: "16:9", label: "16:9", description: "Wide" },
]

export const enhancerModeOptions: Array<{
  value: EnhancerMode
  label: string
}> = [
  { value: "balanced", label: "Balanced" },
  { value: "storyboard", label: "Storyboard" },
  { value: "brand-product", label: "Brand / Product" },
  { value: "doodle-explainer", label: "Doodle / Explainer" },
]

export const generationVersionOptions: Array<{
  value: GenerationVersionCount
  label: string
}> = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 4, label: "4x" },
]

export const generationPollIntervalMs = 2000
