import { constants as fsConstants } from "node:fs"
import { access, stat } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

export const imageVariantWidths = [320, 480, 768, 1024]
export const imageVariantMimeType = "image/webp"

const imageVariantWidthSet = new Set(imageVariantWidths)
const webpQuality = 78

export function isImageVariantWidth(value) {
  return imageVariantWidthSet.has(value)
}

export function createImageOptimizer() {
  return {
    async optimize({ image, sourcePath, assetDir }) {
      const sourceMetadata = await sharp(sourcePath).metadata()
      const width = requireDimension(sourceMetadata.width, "width")
      const height = requireDimension(sourceMetadata.height, "height")
      const placeholderColor = await readPlaceholderColor(sourcePath)
      const variants = []

      for (const variantWidth of imageVariantWidths) {
        const fileName = variantFileName(image.fileName, variantWidth)
        const filePath = path.join(assetDir, fileName)
        const metadata = await ensureVariant({
          sourcePath,
          filePath,
          width: variantWidth,
        })

        variants.push({
          width: metadata.width,
          height: metadata.height,
          fileName,
          mimeType: imageVariantMimeType,
        })
      }

      return { width, height, placeholderColor, variants }
    },
  }
}

export function variantFileName(fileName, width) {
  const extension = path.extname(fileName)
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName

  return `${baseName}-${width}w.webp`
}

async function ensureVariant({ sourcePath, filePath, width }) {
  if (await fileExists(filePath)) {
    const metadata = await sharp(filePath).metadata()
    return {
      width: requireDimension(metadata.width, "variant width"),
      height: requireDimension(metadata.height, "variant height"),
    }
  }

  const result = await sharp(sourcePath)
    .resize({
      width,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: webpQuality })
    .toFile(filePath)

  return {
    width: requireDimension(result.width, "variant width"),
    height: requireDimension(result.height, "variant height"),
  }
}

async function readPlaceholderColor(sourcePath) {
  const { dominant } = await sharp(sourcePath).stats()

  return rgbToHex(dominant.r, dominant.g, dominant.b)
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK)
    const details = await stat(filePath)
    return details.isFile()
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false
    }

    throw error
  }
}

function requireDimension(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Sharp did not return a valid ${label}`)
  }

  return value
}
