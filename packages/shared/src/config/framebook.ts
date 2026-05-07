export const aspectRatios = ["1:1", "3:4", "4:3", "16:9"] as const

export const generationVersionCounts = [1, 2, 4] as const

export const framebookImageTitleMaxLength = 60

export const referenceImageConfig = {
  directoryName: "references",
  maxFiles: 5,
  maxBytes: 10 * 1024 * 1024,
  maxSizeLabel: "10 MB",
  mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  extensionsByMimeType: {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
  },
  preferredExtensionByMimeType: {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
  },
} as const

export const generatedImageConfig = {
  defaultMimeType: "image/png",
  extension: ".png",
} as const
