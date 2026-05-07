import { referenceImageConfig } from "@framebook/shared/config/framebook"
import type { FileRejection } from "react-dropzone"

const referenceImageMimeTypeSet = new Set<string>(
  referenceImageConfig.mimeTypes
)

export const referenceImageDropzoneAccept = Object.fromEntries(
  Object.entries(referenceImageConfig.extensionsByMimeType).map(
    ([mimeType, extensions]) => [mimeType, [...extensions]]
  )
)

export const referenceImageMessages = {
  invalidType: "Reference image must be a PNG, JPEG, or WebP file",
  tooLarge: `Reference image must be ${referenceImageConfig.maxSizeLabel} or smaller`,
  tooMany: `You can attach up to ${referenceImageConfig.maxFiles} images`,
  attachFailed: "Could not attach reference image",
  dropUnsupportedTitle: "Image not supported",
  dropSupportedTitle: "Add reference image",
  dropUnsupportedBody: `Drop a PNG, JPEG, or WebP image up to ${referenceImageConfig.maxSizeLabel}.`,
  dropSupportedBody: "Drop it anywhere to attach it to the prompt.",
} as const

export function isReferenceImageFile(file: File) {
  return referenceImageMimeTypeSet.has(file.type)
}

export function isReferenceImageTooLarge(file: File) {
  return file.size > referenceImageConfig.maxBytes
}

export function referenceImageDropErrorMessage(
  rejections: Array<FileRejection>
) {
  const firstError = rejections.at(0)?.errors.at(0)

  if (firstError?.code === "file-too-large") {
    return referenceImageMessages.tooLarge
  }

  if (firstError?.code === "file-invalid-type") {
    return referenceImageMessages.invalidType
  }

  if (firstError?.code === "too-many-files") {
    return referenceImageMessages.tooMany
  }

  return referenceImageMessages.attachFailed
}

export { referenceImageConfig }
