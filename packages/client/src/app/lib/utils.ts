import { framebookApiUrl } from "@shared/api/framebook"
import { enhancerModeOptions } from "./constants"
import type {
  EnhancerMode,
  ImageRecord,
} from "@framebook/shared/contracts/framebook"
import type { Screen } from "./types"

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
    timeZone: "UTC",
  })
}

export function formatViewerTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
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

export function imageDownloadName(image: ImageRecord) {
  const baseName = image.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 80)

  return `${baseName || "framebook-image"}.png`
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

export function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export function routeForScreen(screen: Screen, topicId?: string | null) {
  if (screen === "settings") {
    return "/settings"
  }

  if (screen === "gallery") {
    return "/gallery"
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
