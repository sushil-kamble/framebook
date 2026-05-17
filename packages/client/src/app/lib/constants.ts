import {
  aspectRatios,
  generationVersionCounts,
} from "@framebook/shared/config/framebook"
import type {
  AspectRatio,
  GenerationVersionCount,
} from "@framebook/shared/contracts/framebook"

const aspectRatioLabels: Record<
  AspectRatio,
  {
    label: string
    description: string
  }
> = {
  "1:1": { label: "1:1", description: "Square" },
  "3:4": { label: "3:4", description: "Portrait" },
  "4:3": { label: "4:3", description: "Landscape" },
  "16:9": { label: "16:9", description: "Wide" },
}

export const aspectRatioOptions: Array<{
  value: AspectRatio
  label: string
  description: string
}> = aspectRatios.map((value) => ({
  value,
  ...aspectRatioLabels[value],
}))

export const generationVersionOptions: Array<{
  value: GenerationVersionCount
  label: string
}> = generationVersionCounts.map((value) => ({
  value,
  label: `${value}x`,
}))

export const generationPollIntervalMs = 2000
