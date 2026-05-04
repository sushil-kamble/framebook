import { framebookApiUrl } from "@shared/api/framebook"
import { enhancerModeOptions } from "./constants"
import type {
  EnhancerMode,
  ImageRecord,
  ImageVariant,
} from "@framebook/shared/contracts/framebook"
import type { Screen } from "./types"

const imageVariantWidthPattern = /-(320|480|768|1024)w\.webp$/u

export function modeLabel(mode: EnhancerMode) {
  return (
    enhancerModeOptions.find((option) => option.value === mode)?.label ?? mode
  )
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatViewerTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function imageResolutionLabel(
  resolution: { width: number; height: number } | null
) {
  if (!resolution) {
    return "Loading size"
  }

  return `${resolution.width} × ${resolution.height}`
}

export function imageFileUrl(imageId: string) {
  return framebookApiUrl(`/api/images/${encodeURIComponent(imageId)}/file`)
}

export function imageVariantUrl(imageId: string, width: number) {
  return framebookApiUrl(
    `/api/images/${encodeURIComponent(imageId)}/variants/${width}`
  )
}

export function imageSrcSet(image: ImageRecord) {
  const srcSet = image.variants
    ?.map((variant) => imageSrcSetEntry(image.id, variant))
    .filter((entry): entry is string => Boolean(entry))
    .join(", ")

  return srcSet || undefined
}

export function imageGridSizes(kind: "topic" | "starred") {
  if (kind === "topic") {
    return "(min-width: 1024px) 33vw, 33vw"
  }

  return "(min-width: 768px) 50vw, 50vw"
}

export function imageDownloadName(image: ImageRecord) {
  const baseName = image.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 80)

  return `${baseName || "framebook-image"}.png`
}

function imageSrcSetEntry(imageId: string, variant: ImageVariant) {
  const requestedWidth = imageVariantRequestWidth(variant)

  if (!requestedWidth) {
    return null
  }

  return `${imageVariantUrl(imageId, requestedWidth)} ${variant.width}w`
}

function imageVariantRequestWidth(variant: ImageVariant) {
  const width = variant.fileName.match(imageVariantWidthPattern)?.[1]

  if (!width) {
    return null
  }

  return Number.parseInt(width, 10)
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

export function routeForScreen(screen: Screen, topicId?: string | null) {
  if (screen === "settings") {
    return "/settings"
  }

  if (screen === "gallery" || screen === "starred") {
    return "/starred"
  }

  if (screen === "topic-editor") {
    return topicId
      ? `/topics/${encodeURIComponent(topicId)}/edit`
      : "/topics/new"
  }

  if (screen === "topic" && topicId) {
    return `/topics/${encodeURIComponent(topicId)}`
  }

  return "/topics"
}
