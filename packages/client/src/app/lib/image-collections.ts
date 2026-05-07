import type { ImageRecord } from "@framebook/shared/contracts/framebook"
import type { Screen } from "./types"

export function isStarredImagesScreen(screen: Screen) {
  return screen === "starred" || screen === "gallery"
}

export function updateStarredImages(
  current: Array<ImageRecord>,
  image: ImageRecord
) {
  if (!image.favorite || image.archivedAt) {
    return current.filter((candidate) => candidate.id !== image.id)
  }

  const next = current.some((candidate) => candidate.id === image.id)
    ? current.map((candidate) =>
        candidate.id === image.id ? image : candidate
      )
    : [image, ...current]

  return next.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )
}
