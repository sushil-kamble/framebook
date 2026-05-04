import { createReadStream } from "node:fs"
import { spawn } from "node:child_process"
import Busboy from "busboy"
import {
  corsHeaders,
  sendJson,
  readJsonBody,
  sendNoContent,
} from "#infra/http/http.mjs"
import { createFramebookService } from "#domains/framebook/service.mjs"

let framebookService
const maxReferenceImages = 5
const maxReferenceImageBytes = 10 * 1024 * 1024
const referenceImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
])

export async function routeRequest(request, response) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1")
  const pathname = url.pathname

  try {
    if (request.method === "OPTIONS") {
      sendNoContent(response)
      return
    }

    if (pathname === "/api/health" && request.method === "GET") {
      const service = getFramebookService()
      sendJson(response, 200, {
        ok: true,
        dataDir: service.dataDir,
        dbPath: service.dbPath,
        codexAppServerConfigured: true,
        codexAppServerCommand: process.env.FRAMEBOOK_CODEX_BIN || "codex",
      })
      return
    }

    if (pathname === "/api/topics" && request.method === "GET") {
      const topics = await getFramebookService().listTopics({
        includeArchived: url.searchParams.get("includeArchived") === "true",
      })
      sendJson(response, 200, { topics })
      return
    }

    if (pathname === "/api/topics" && request.method === "POST") {
      const topic = await getFramebookService().createTopic(
        await readJsonBody(request)
      )
      sendJson(response, 201, { topic })
      return
    }

    const topicMatch = pathname.match(/^\/api\/topics\/([^/]+)$/u)
    if (topicMatch && request.method === "GET") {
      const topic = await getFramebookService().getTopic(
        decodeURIComponent(topicMatch[1])
      )
      sendJson(response, 200, { topic })
      return
    }

    if (topicMatch && request.method === "PATCH") {
      const topic = await getFramebookService().updateTopic(
        decodeURIComponent(topicMatch[1]),
        await readJsonBody(request)
      )
      sendJson(response, 200, { topic })
      return
    }

    const topicArchiveMatch = pathname.match(
      /^\/api\/topics\/([^/]+)\/archive$/u
    )
    if (topicArchiveMatch && request.method === "POST") {
      const topic = await getFramebookService().archiveTopic(
        decodeURIComponent(topicArchiveMatch[1])
      )
      sendJson(response, 200, { topic })
      return
    }

    const topicUnarchiveMatch = pathname.match(
      /^\/api\/topics\/([^/]+)\/unarchive$/u
    )
    if (topicUnarchiveMatch && request.method === "POST") {
      const topic = await getFramebookService().unarchiveTopic(
        decodeURIComponent(topicUnarchiveMatch[1])
      )
      sendJson(response, 200, { topic })
      return
    }

    const topicImagesMatch = pathname.match(/^\/api\/topics\/([^/]+)\/images$/u)
    if (topicImagesMatch && request.method === "GET") {
      const images = await getFramebookService().listImages(
        decodeURIComponent(topicImagesMatch[1]),
        {
          favoriteOnly: url.searchParams.get("favorite") === "true",
        }
      )
      sendJson(response, 200, { images })
      return
    }

    if (pathname === "/api/images" && request.method === "GET") {
      const images =
        url.searchParams.get("archived") === "true"
          ? await getFramebookService().listArchivedImages()
          : await getFramebookService().listStarredImages()
      sendJson(response, 200, { images })
      return
    }

    const promptMatch = pathname.match(
      /^\/api\/topics\/([^/]+)\/prompt\/enhance$/u
    )
    if (promptMatch && request.method === "POST") {
      const result = await getFramebookService().enhanceTopicPrompt(
        decodeURIComponent(promptMatch[1]),
        await readJsonBody(request)
      )
      sendJson(response, 200, result)
      return
    }

    const generationMatch = pathname.match(
      /^\/api\/topics\/([^/]+)\/generations$/u
    )
    if (generationMatch && request.method === "POST") {
      const generationInput = isMultipartRequest(request)
        ? await readGenerationMultipartBody(request)
        : await readJsonBody(request)
      const job = await getFramebookService().createGeneration(
        decodeURIComponent(generationMatch[1]),
        generationInput
      )
      sendJson(response, 202, { job })
      return
    }

    const generationJobsMatch = pathname.match(
      /^\/api\/topics\/([^/]+)\/generation-jobs$/u
    )
    if (generationJobsMatch && request.method === "GET") {
      const jobs = await getFramebookService().listGenerationJobs(
        decodeURIComponent(generationJobsMatch[1]),
        {
          activeOnly: url.searchParams.get("activeOnly") === "true",
          ensureActive: url.searchParams.get("ensureActive") !== "false",
        }
      )
      sendJson(response, 200, { jobs })
      return
    }

    const jobMatch = pathname.match(/^\/api\/generation-jobs\/([^/]+)$/u)
    if (jobMatch && request.method === "GET") {
      const job = await getFramebookService().getGenerationJob(
        decodeURIComponent(jobMatch[1])
      )
      sendJson(response, 200, { job })
      return
    }

    const imageMatch = pathname.match(/^\/api\/images\/([^/]+)$/u)
    if (imageMatch && request.method === "GET") {
      const image = await getFramebookService().getImage(
        decodeURIComponent(imageMatch[1])
      )
      sendJson(response, 200, { image })
      return
    }

    if (imageMatch && request.method === "PATCH") {
      const image = await getFramebookService().updateImage(
        decodeURIComponent(imageMatch[1]),
        await readJsonBody(request)
      )
      sendJson(response, 200, { image })
      return
    }

    const imageVariantMatch = pathname.match(
      /^\/api\/images\/([^/]+)\/variants\/([^/]+)$/u
    )
    if (imageVariantMatch && request.method === "GET") {
      const { filePath, mimeType, etag } =
        await getFramebookService().getImageVariantFile(
          decodeURIComponent(imageVariantMatch[1]),
          parseVariantWidth(imageVariantMatch[2])
        )

      if (request.headers["if-none-match"] === etag) {
        response.writeHead(304, {
          ...corsHeaders(),
          etag,
          "cache-control": "public, max-age=31536000, immutable",
        })
        response.end()
        return
      }

      response.writeHead(200, {
        ...corsHeaders(),
        "content-type": mimeType,
        "cache-control": "public, max-age=31536000, immutable",
        etag,
      })
      createReadStream(filePath).pipe(response)
      return
    }

    const imageFileMatch = pathname.match(/^\/api\/images\/([^/]+)\/file$/u)
    if (imageFileMatch && request.method === "GET") {
      const { filePath, mimeType } = await getFramebookService().getImageFile(
        decodeURIComponent(imageFileMatch[1])
      )
      response.writeHead(200, { ...corsHeaders(), "content-type": mimeType })
      createReadStream(filePath).pipe(response)
      return
    }

    const referenceFileMatch = pathname.match(
      /^\/api\/images\/([^/]+)\/references\/([^/]+)\/file$/u
    )
    if (referenceFileMatch && request.method === "GET") {
      const { filePath, mimeType } =
        await getFramebookService().getReferenceImageFile(
          decodeURIComponent(referenceFileMatch[1]),
          decodeURIComponent(referenceFileMatch[2])
        )
      response.writeHead(200, { ...corsHeaders(), "content-type": mimeType })
      createReadStream(filePath).pipe(response)
      return
    }

    const revealMatch = pathname.match(/^\/api\/images\/([^/]+)\/reveal$/u)
    if (revealMatch && request.method === "POST") {
      const { filePath } = await getFramebookService().getImageFile(
        decodeURIComponent(revealMatch[1])
      )
      const revealed = revealPath(filePath)
      sendJson(response, 200, { path: filePath, revealed })
      return
    }

    sendJson(response, 404, { error: "Not Found" })
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500
    const message = statusCode === 500 ? "Internal Server Error" : error.message

    if (statusCode === 500) {
      console.error(error)
    }

    sendJson(response, statusCode, { error: message })
  }
}

export function getFramebookService() {
  framebookService ??= createFramebookService()
  return framebookService
}

export function setFramebookServiceForTesting(service) {
  framebookService = service
}

export async function closeFramebookService() {
  const service = framebookService
  framebookService = undefined
  await service?.close?.()
}

function isMultipartRequest(request) {
  return String(request.headers["content-type"] ?? "")
    .toLowerCase()
    .startsWith("multipart/form-data")
}

async function readGenerationMultipartBody(request) {
  return new Promise((resolve, reject) => {
    const fields = {}
    const referenceImages = []
    let parser
    let parserError = null

    try {
      parser = Busboy({
        headers: request.headers,
        limits: {
          files: maxReferenceImages + 1,
          fileSize: maxReferenceImageBytes + 1,
        },
      })
    } catch (error) {
      reject(badRequest(`Invalid multipart request: ${errorMessage(error)}`))
      return
    }

    parser.on("field", (name, value) => {
      if (
        name === "rawPrompt" ||
        name === "enhancedPrompt" ||
        name === "title" ||
        name === "aspectRatio" ||
        name === "resolutionPreset"
      ) {
        fields[name] = value
      }
    })

    parser.on("file", (name, file, info) => {
      const chunks = []
      let sizeBytes = 0
      const mimeType = String(info.mimeType ?? "").toLowerCase()

      if (name !== "referenceImages") {
        parserError ??= badRequest("Unexpected file field")
        file.resume()
        return
      }

      if (referenceImages.length >= maxReferenceImages) {
        parserError ??= badRequest(
          `You can attach up to ${maxReferenceImages} images`
        )
        file.resume()
        return
      }

      if (!referenceImageMimeTypes.has(mimeType)) {
        parserError ??= badRequest(
          "Reference image must be a PNG, JPEG, or WebP file"
        )
        file.resume()
        return
      }

      file.on("data", (chunk) => {
        sizeBytes += chunk.length
        if (sizeBytes <= maxReferenceImageBytes) {
          chunks.push(chunk)
        }
      })

      file.on("limit", () => {
        parserError ??= badRequest("Reference image must be 10 MB or smaller")
      })

      file.on("error", (error) => {
        parserError ??= error
      })

      file.on("end", () => {
        if (sizeBytes > maxReferenceImageBytes) {
          parserError ??= badRequest("Reference image must be 10 MB or smaller")
          return
        }

        referenceImages.push({
          originalName: info.filename,
          mimeType,
          sizeBytes,
          buffer: Buffer.concat(chunks),
        })
      })
    })

    parser.on("error", (error) => {
      parserError ??= error
    })

    parser.on("finish", () => {
      if (parserError) {
        reject(parserError)
        return
      }

      resolve({ ...fields, referenceImages })
    })

    request.pipe(parser)
  })
}

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function revealPath(filePath) {
  if (process.env.FRAMEBOOK_DISABLE_REVEAL === "1") {
    return false
  }

  const opener = process.platform === "darwin" ? "open" : "xdg-open"
  const child = spawn(opener, [filePath], {
    detached: true,
    stdio: "ignore",
  })
  child.unref()
  return true
}

function parseVariantWidth(value) {
  if (!/^\d+$/u.test(value)) {
    return Number.NaN
  }

  return Number.parseInt(value, 10)
}
