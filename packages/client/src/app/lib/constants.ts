import type {
  AspectRatio,
  EnhancerMode,
  ResolutionPreset,
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

export const resolutionPresetOptions: Array<{
  value: ResolutionPreset
  label: string
}> = [
  { value: "1k", label: "Standard 1K" },
  { value: "2k", label: "High 2K resolution" },
  { value: "4k", label: "Ultra 4K resolution" },
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

export const generationPollAttempts = 300
export const generationPollIntervalMs = 2000
