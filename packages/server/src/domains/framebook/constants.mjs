import {
  aspectRatios,
  framebookImageTitleMaxLength,
  generationVersionCounts,
  generatedImageConfig,
  referenceImageConfig,
} from "@framebook/shared/config/framebook"

export const ASPECT_RATIOS = new Set(aspectRatios)

export const GENERATION_VERSION_COUNTS = new Set(generationVersionCounts)

export const imageTitleMaxLength = framebookImageTitleMaxLength

export const defaultGeneratedImageMimeType =
  generatedImageConfig.defaultMimeType

export const generatedImageExtension = generatedImageConfig.extension

export const referenceDirName = referenceImageConfig.directoryName

export const maxReferenceImages = referenceImageConfig.maxFiles

export const maxReferenceImageBytes = referenceImageConfig.maxBytes

export const referenceImageMaxSizeLabel = referenceImageConfig.maxSizeLabel

export const referenceImageMimeTypes = new Set(referenceImageConfig.mimeTypes)

export const referenceImageExtensions =
  referenceImageConfig.preferredExtensionByMimeType

export function isAspectRatio(value) {
  return ASPECT_RATIOS.has(value)
}

export function isGenerationVersionCount(value) {
  return GENERATION_VERSION_COUNTS.has(value)
}
