import { constants as fsConstants } from "node:fs"
import { access, stat } from "node:fs/promises"
import path from "node:path"
import { enhancePrompt } from "./enhancer.mjs"
import { isAspectRatio, isEnhancerMode } from "./constants.mjs"
import {
  createImageOptimizer,
  imageVariantMimeType,
  imageVariantWidths,
  isImageVariantWidth,
  variantFileName,
} from "./image-optimizer.mjs"
import { createFramebookStore } from "./storage.mjs"
import { createCodexClient } from "#infra/agent-clients/codex.mjs"

const resolutionPresets = new Set(["1k", "2k", "4k"])
const imageTitleMaxLength = 60

export function createFramebookService({
  store = createFramebookStore(),
  codexClient = createCodexClient(),
  imageOptimizer = createImageOptimizer(),
  autoRunJobs = true,
} = {}) {
  const jobRunners = new Map()

  async function listTopics({ includeArchived = false } = {}) {
    const [topics, images] = await Promise.all([
      store.listTopics(),
      store.listImages(),
    ])
    return topics
      .filter((topic) => includeArchived || !topic.archivedAt)
      .map((topic) => summarizeTopic(topic, images))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async function getTopic(topicId) {
    const topics = await store.listTopics()
    const topic = topics.find((candidate) => candidate.id === topicId)

    if (!topic) {
      throw notFound("Topic not found")
    }

    const images = await store.listImages()
    return summarizeTopic(topic, images)
  }

  async function createTopic(input) {
    const now = new Date().toISOString()
    const topic = {
      id: store.createId(),
      name: requireText(input.name, "Topic name is required"),
      description: optionalText(input.description),
      instruction: requireText(
        input.instruction,
        "Topic instruction is required"
      ),
      defaultAspectRatio: requireAspectRatio(input.defaultAspectRatio),
      basePromptDetails: optionalText(input.basePromptDetails),
      enhancerMode: requireEnhancerMode(input.enhancerMode),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const topics = await store.listTopics()
    await store.writeTopics([...topics, topic])
    return summarizeTopic(topic, [])
  }

  async function updateTopic(topicId, input) {
    const topics = await store.listTopics()
    const topicIndex = topics.findIndex((topic) => topic.id === topicId)

    if (topicIndex === -1) {
      throw notFound("Topic not found")
    }

    const current = topics[topicIndex]
    const updated = {
      ...current,
      name:
        input.name === undefined
          ? current.name
          : requireText(input.name, "Topic name is required"),
      description:
        input.description === undefined
          ? current.description
          : optionalText(input.description),
      instruction:
        input.instruction === undefined
          ? current.instruction
          : requireText(input.instruction, "Topic instruction is required"),
      defaultAspectRatio:
        input.defaultAspectRatio === undefined
          ? current.defaultAspectRatio
          : requireAspectRatio(input.defaultAspectRatio),
      basePromptDetails:
        input.basePromptDetails === undefined
          ? current.basePromptDetails
          : optionalText(input.basePromptDetails),
      enhancerMode:
        input.enhancerMode === undefined
          ? current.enhancerMode
          : requireEnhancerMode(input.enhancerMode),
      updatedAt: new Date().toISOString(),
    }

    topics[topicIndex] = updated
    await store.writeTopics(topics)
    const images = await store.listImages()
    return summarizeTopic(updated, images)
  }

  async function archiveTopic(topicId) {
    const topics = await store.listTopics()
    const topicIndex = topics.findIndex((topic) => topic.id === topicId)

    if (topicIndex === -1) {
      throw notFound("Topic not found")
    }

    const updated = {
      ...topics[topicIndex],
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    topics[topicIndex] = updated
    await store.writeTopics(topics)
    const images = await store.listImages()
    return summarizeTopic(updated, images)
  }

  async function unarchiveTopic(topicId) {
    const topics = await store.listTopics()
    const topicIndex = topics.findIndex((topic) => topic.id === topicId)

    if (topicIndex === -1) {
      throw notFound("Topic not found")
    }

    const updated = {
      ...topics[topicIndex],
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    }

    topics[topicIndex] = updated
    await store.writeTopics(topics)
    const images = await store.listImages()
    return summarizeTopic(updated, images)
  }

  async function listImages(topicId, { favoriteOnly = false } = {}) {
    await ensureTopic(topicId)
    const images = await listImagesWithOptimization(
      (image) => image.topicId === topicId
    )
    return images
      .filter((image) => image.topicId === topicId)
      .filter((image) => !image.archivedAt)
      .filter((image) => !favoriteOnly || image.favorite)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async function listStarredImages() {
    const [topics, images] = await Promise.all([
      store.listTopics(),
      store.listImages(),
    ])
    const activeTopicIds = new Set(
      topics.filter((topic) => !topic.archivedAt).map((topic) => topic.id)
    )
    const optimizedImages = await ensureImageOptimizations(
      images,
      (image) =>
        activeTopicIds.has(image.topicId) && !image.archivedAt && image.favorite
    )

    return optimizedImages
      .filter((image) => activeTopicIds.has(image.topicId))
      .filter((image) => !image.archivedAt)
      .filter((image) => image.favorite)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async function listArchivedImages() {
    const images = await store.listImages()
    return images
      .filter((image) => image.archivedAt)
      .sort((left, right) =>
        (right.archivedAt ?? "").localeCompare(left.archivedAt ?? "")
      )
  }

  async function addImageRecord(input) {
    const topic = await ensureTopic(input.topicId)
    const now = new Date().toISOString()
    const record = {
      id: input.id || store.createId(),
      topicId: topic.id,
      generationJobId: input.generationJobId ?? null,
      title:
        normalizeImageTitle(input.title) || titleFromPrompt(input.rawPrompt),
      rawPrompt: requireText(input.rawPrompt, "Raw prompt is required"),
      enhancedPrompt: requireText(
        input.enhancedPrompt,
        "Enhanced prompt is required"
      ),
      finalPrompt: requireText(input.finalPrompt, "Final prompt is required"),
      aspectRatio: requireAspectRatio(input.aspectRatio),
      enhancerMode: requireEnhancerMode(
        input.enhancerMode || topic.enhancerMode
      ),
      topicSnapshot: snapshotTopic(topic),
      favorite: Boolean(input.favorite),
      archivedAt: input.archivedAt ?? null,
      fileName: requireText(input.fileName, "Image file name is required"),
      mimeType: input.mimeType || "image/png",
      createdAt: input.createdAt || now,
    }
    const optimizedRecord = await maybeOptimizeImageRecord(record)

    const [topics, images] = await Promise.all([
      store.listTopics(),
      store.listImages(),
    ])
    await store.writeImages([...images, optimizedRecord])
    await touchTopic(topics, topic.id, optimizedRecord.createdAt)
    return optimizedRecord
  }

  async function updateImage(imageId, input) {
    const images = await store.listImages()
    const imageIndex = images.findIndex((image) => image.id === imageId)

    if (imageIndex === -1) {
      throw notFound("Image not found")
    }

    const current = images[imageIndex]
    const updated = {
      ...current,
      favorite:
        input.favorite === undefined
          ? current.favorite
          : Boolean(input.favorite),
      archivedAt:
        input.archived === undefined
          ? (current.archivedAt ?? null)
          : input.archived
            ? new Date().toISOString()
            : null,
    }

    images[imageIndex] = updated
    await store.writeImages(images)
    return updated
  }

  async function getImage(imageId) {
    const images = await store.listImages()
    const image = images.find((candidate) => candidate.id === imageId)

    if (!image) {
      throw notFound("Image not found")
    }

    return optimizeImageInCollection(imageId)
  }

  async function getImageFile(imageId) {
    const image = await getImage(imageId)
    const filePath = path.join(
      store.getTopicAssetDir(image.topicId),
      image.fileName
    )
    return { filePath, mimeType: image.mimeType, image }
  }

  async function getImageVariantFile(imageId, width) {
    if (!isImageVariantWidth(width)) {
      throw badRequest("Unsupported image variant width")
    }

    let image = await getImage(imageId)
    let variant = findImageVariant(image, width)
    let filePath = variant
      ? path.join(store.getTopicAssetDir(image.topicId), variant.fileName)
      : null

    if (!variant || !(await fileExists(filePath))) {
      image = await optimizeImageInCollection(imageId, { force: true })
      variant = findImageVariant(image, width)
      filePath = variant
        ? path.join(store.getTopicAssetDir(image.topicId), variant.fileName)
        : null
    }

    if (!variant || !(await fileExists(filePath))) {
      throw notFound("Image variant not found")
    }

    const details = await stat(filePath)
    return {
      filePath,
      mimeType: imageVariantMimeType,
      etag: etagForStat(details),
      image,
      variant,
    }
  }

  async function enhanceTopicPrompt(topicId, input) {
    const topic = await ensureTopic(topicId)
    const rawPrompt = requireText(input.rawPrompt, "Raw prompt is required")
    const enhancedPrompt = await resolveEnhancedPrompt({ topic, rawPrompt })

    return {
      rawPrompt,
      enhancedPrompt,
      aspectRatio: topic.defaultAspectRatio,
    }
  }

  async function createGeneration(topicId, input) {
    const topic = await ensureTopic(topicId)
    const rawPrompt = requireText(input.rawPrompt, "Raw prompt is required")
    const aspectRatio = input.aspectRatio
      ? requireAspectRatio(input.aspectRatio)
      : topic.defaultAspectRatio
    const resolutionPreset = requireResolutionPreset(input.resolutionPreset)
    const enhancedPrompt =
      optionalText(input.enhancedPrompt) ||
      (await resolveEnhancedPrompt({ topic, rawPrompt }))
    const title = await resolveImageTitle({
      topic,
      rawPrompt,
      enhancedPrompt,
      inputTitle: input.title,
    })
    const finalPrompt = buildFinalPrompt({
      enhancedPrompt,
      aspectRatio,
      resolutionPreset,
    })
    const now = new Date().toISOString()
    const job = {
      id: store.createId(),
      topicId: topic.id,
      status: "queued",
      title,
      rawPrompt,
      enhancedPrompt,
      finalPrompt,
      aspectRatio,
      resolutionPreset,
      imageId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }

    const jobs = await store.listJobs()
    await store.writeJobs([...jobs, job])

    if (autoRunJobs) {
      startGenerationJob(job.id)
    }

    return job
  }

  async function listGenerationJobs(
    topicId,
    { activeOnly = false, ensureActive = false } = {}
  ) {
    const topic = await ensureTopic(topicId)
    const jobs = await store.listJobs()
    const filteredJobs = jobs
      .map(normalizeGenerationJob)
      .filter((job) => job.topicId === topic.id)
      .filter((job) => !activeOnly || isActiveGenerationJob(job))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    if (ensureActive) {
      for (const job of filteredJobs) {
        if (isActiveGenerationJob(job)) {
          startGenerationJob(job.id)
        }
      }
    }

    return filteredJobs
  }

  async function getGenerationJob(jobId) {
    const jobs = await store.listJobs()
    const job = jobs.find((candidate) => candidate.id === jobId)

    if (!job) {
      throw notFound("Generation job not found")
    }

    return normalizeGenerationJob(job)
  }

  async function runGenerationJob(jobId) {
    if (jobRunners.has(jobId)) {
      return jobRunners.get(jobId)
    }

    const promise = runGenerationJobInternal(jobId)
    jobRunners.set(jobId, promise)

    try {
      return await promise
    } finally {
      jobRunners.delete(jobId)
    }
  }

  async function runGenerationJobInternal(jobId) {
    const currentJob = await getGenerationJob(jobId)
    if (!isActiveGenerationJob(currentJob)) {
      return currentJob
    }

    let job = await updateJob(jobId, {
      status: "running",
      title: currentJob.title || titleFromPrompt(currentJob.rawPrompt),
      error: null,
      updatedAt: new Date().toISOString(),
    })
    const topic = await ensureTopic(job.topicId)

    try {
      const outputDir = store.getTopicAssetDir(topic.id)
      const fileName = `${job.id}.png`
      const generated = await codexClient.generateImage({
        prompt: job.finalPrompt,
        rawPrompt: job.rawPrompt,
        aspectRatio: job.aspectRatio,
        resolutionPreset: job.resolutionPreset,
        topic,
        outputDir,
        fileName,
      })
      const image = await addImageRecord({
        topicId: topic.id,
        generationJobId: job.id,
        title: job.title,
        rawPrompt: job.rawPrompt,
        enhancedPrompt: job.enhancedPrompt,
        finalPrompt: job.finalPrompt,
        aspectRatio: job.aspectRatio,
        enhancerMode: topic.enhancerMode,
        fileName: generated.fileName,
        mimeType: generated.mimeType,
      })

      job = await updateJob(job.id, {
        status: "succeeded",
        imageId: image.id,
        error: null,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      job = await updateJob(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Generation failed",
        updatedAt: new Date().toISOString(),
      })
    }

    return job
  }

  function startGenerationJob(jobId) {
    if (!autoRunJobs || jobRunners.has(jobId)) {
      return
    }

    void runGenerationJob(jobId).catch((error) => {
      console.error(
        `[framebook] generation job ${jobId} crashed outside job state`,
        error
      )
    })
  }

  async function listImagesWithOptimization(shouldOptimize) {
    const images = await store.listImages()
    return ensureImageOptimizations(images, shouldOptimize)
  }

  async function ensureImageOptimizations(images, shouldOptimize) {
    let changed = false
    const optimizedImages = []

    for (const image of images) {
      const optimizedImage = shouldOptimize(image)
        ? await maybeOptimizeImageRecord(image)
        : image

      if (optimizedImage !== image) {
        changed = true
      }

      optimizedImages.push(optimizedImage)
    }

    if (changed) {
      await store.writeImages(optimizedImages)
    }

    return optimizedImages
  }

  async function optimizeImageInCollection(imageId, { force = false } = {}) {
    const images = await store.listImages()
    const imageIndex = images.findIndex((candidate) => candidate.id === imageId)

    if (imageIndex === -1) {
      throw notFound("Image not found")
    }

    const optimizedImage = await maybeOptimizeImageRecord(images[imageIndex], {
      force,
    })

    if (optimizedImage !== images[imageIndex]) {
      images[imageIndex] = optimizedImage
      await store.writeImages(images)
    }

    return optimizedImage
  }

  async function maybeOptimizeImageRecord(image, { force = false } = {}) {
    if (!force && hasCompleteOptimization(image)) {
      return image
    }

    if (!canOptimizeImage(image)) {
      return image
    }

    const assetDir = store.getTopicAssetDir(image.topicId)
    const sourcePath = path.join(assetDir, image.fileName)

    if (!(await fileExists(sourcePath))) {
      return image
    }

    try {
      const optimization = await imageOptimizer.optimize({
        image,
        sourcePath,
        assetDir,
      })
      return { ...image, ...optimization }
    } catch (error) {
      throw new Error(
        `Failed to optimize image ${image.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      )
    }
  }

  async function ensureTopic(topicId) {
    const topics = await store.listTopics()
    const topic = topics.find((candidate) => candidate.id === topicId)

    if (!topic) {
      throw notFound("Topic not found")
    }

    return topic
  }

  async function updateJob(jobId, patch) {
    const jobs = await store.listJobs()
    const jobIndex = jobs.findIndex((candidate) => candidate.id === jobId)

    if (jobIndex === -1) {
      throw notFound("Generation job not found")
    }

    const updated = { ...jobs[jobIndex], ...patch }
    jobs[jobIndex] = updated
    await store.writeJobs(jobs)
    return updated
  }

  async function touchTopic(topics, topicId, updatedAt) {
    const topicIndex = topics.findIndex((topic) => topic.id === topicId)

    if (topicIndex === -1) {
      return
    }

    topics[topicIndex] = { ...topics[topicIndex], updatedAt }
    await store.writeTopics(topics)
  }

  async function resolveEnhancedPrompt({ topic, rawPrompt }) {
    return typeof codexClient.enhancePrompt === "function"
      ? await codexClient.enhancePrompt({ topic, rawPrompt })
      : enhancePrompt({ topic, rawPrompt })
  }

  async function resolveImageTitle({
    topic,
    rawPrompt,
    enhancedPrompt,
    inputTitle,
  }) {
    const explicitTitle =
      normalizeImageTitle(inputTitle) ||
      extractExplicitTitleFromPrompt(rawPrompt)

    if (explicitTitle) {
      return explicitTitle
    }

    if (typeof codexClient.generateTitle !== "function") {
      return titleFromPrompt(rawPrompt)
    }

    try {
      const generatedTitle = await codexClient.generateTitle({
        topic,
        rawPrompt,
        enhancedPrompt,
      })
      return normalizeImageTitle(generatedTitle) || titleFromPrompt(rawPrompt)
    } catch (error) {
      console.warn(
        `[framebook] title generation failed, falling back to prompt title: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return titleFromPrompt(rawPrompt)
    }
  }

  return {
    dataDir: store.rootDir,
    dbPath: store.dbPath,
    listTopics,
    getTopic,
    createTopic,
    updateTopic,
    archiveTopic,
    unarchiveTopic,
    listImages,
    listStarredImages,
    listArchivedImages,
    addImageRecord,
    updateImage,
    getImage,
    getImageFile,
    getImageVariantFile,
    enhanceTopicPrompt,
    createGeneration,
    listGenerationJobs,
    getGenerationJob,
    runGenerationJob,
  }
}

function hasCompleteOptimization(image) {
  return (
    Number.isInteger(image.width) &&
    image.width > 0 &&
    Number.isInteger(image.height) &&
    image.height > 0 &&
    typeof image.placeholderColor === "string" &&
    imageVariantWidths.every((width) =>
      image.variants?.some(
        (variant) =>
          variant.fileName === variantFileName(image.fileName, width) &&
          variant.mimeType === imageVariantMimeType
      )
    )
  )
}

function canOptimizeImage(image) {
  return (
    String(image.mimeType).startsWith("image/") &&
    image.mimeType !== "image/svg+xml"
  )
}

function findImageVariant(image, width) {
  const expectedFileName = variantFileName(image.fileName, width)

  return image.variants?.find(
    (variant) =>
      variant.fileName === expectedFileName &&
      variant.mimeType === imageVariantMimeType
  )
}

async function fileExists(filePath) {
  if (!filePath) {
    return false
  }

  try {
    await access(filePath, fsConstants.F_OK)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false
    }

    throw error
  }
}

function etagForStat(details) {
  return `"${details.size.toString(16)}-${Math.trunc(details.mtimeMs).toString(
    16
  )}"`
}

function isActiveGenerationJob(job) {
  return job.status === "queued" || job.status === "running"
}

function normalizeGenerationJob(job) {
  return {
    ...job,
    title: normalizeImageTitle(job.title) || titleFromPrompt(job.rawPrompt),
  }
}

function summarizeTopic(topic, images) {
  const topicImages = images
    .filter((image) => image.topicId === topic.id && !image.archivedAt)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const latestImage = topicImages[0] ?? null

  return {
    ...topic,
    imageCount: topicImages.length,
    favoriteCount: topicImages.filter((image) => image.favorite).length,
    latestImageId: latestImage?.id ?? null,
    latestImageCreatedAt: latestImage?.createdAt ?? null,
  }
}

function snapshotTopic(topic) {
  return {
    id: topic.id,
    name: topic.name,
    instruction: topic.instruction,
    defaultAspectRatio: topic.defaultAspectRatio,
    basePromptDetails: topic.basePromptDetails,
    enhancerMode: topic.enhancerMode,
  }
}

function requireText(value, message) {
  const text = optionalText(value)

  if (!text) {
    throw badRequest(message)
  }

  return text
}

function optionalText(value) {
  return String(value ?? "").trim()
}

function requireAspectRatio(value) {
  if (!isAspectRatio(value)) {
    throw badRequest("Invalid aspect ratio")
  }

  return value
}

function requireEnhancerMode(value) {
  if (!isEnhancerMode(value)) {
    throw badRequest("Invalid enhancer mode")
  }

  return value
}

function requireResolutionPreset(value) {
  if (value === undefined || value === null || value === "") {
    return "1k"
  }

  if (!resolutionPresets.has(value)) {
    throw badRequest("Invalid resolution preset")
  }

  return value
}

function buildFinalPrompt({ enhancedPrompt, aspectRatio, resolutionPreset }) {
  return [
    enhancedPrompt,
    "",
    "Generation requirements:",
    `- Aspect ratio: ${aspectRatio}`,
    `- Output resolution: ${formatResolutionPreset(resolutionPreset)}`,
  ].join("\n")
}

function formatResolutionPreset(value) {
  switch (value) {
    case "2k":
      return "2K"
    case "4k":
      return "4K"
    case "1k":
    default:
      return "1K"
  }
}

function extractExplicitTitleFromPrompt(prompt) {
  const match = String(prompt ?? "").match(
    /^\s*(?:image\s+title|title)\s*:\s*([^\n\r]+)/iu
  )
  return normalizeImageTitle(match?.[1])
}

function normalizeImageTitle(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^```(?:text)?/iu, "")
    .replace(/```$/u, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return ""
  }

  const cleaned = normalized
    .replace(/^(?:image\s+title|title)\s*:\s*/iu, "")
    .replace(/^["'`*_]+|["'`*_]+$/gu, "")
    .replace(/\b(?:high|best|premium|ultra)\s+quality\b/giu, "")
    .replace(/\bultra[-\s]?detailed\b/giu, "")
    .replace(/\baspect\s*ratio\s*:?\s*\d+\s*:\s*\d+\b/giu, "")
    .replace(/\b\d+\s*k\s*(?:output\s*)?resolution\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/[|,;:./\-\s]+$/gu, "")
    .trim()

  if (!cleaned) {
    return ""
  }

  if (cleaned.length <= imageTitleMaxLength) {
    return cleaned
  }

  const wordBoundary = cleaned
    .slice(0, imageTitleMaxLength)
    .replace(/\s+\S*$/u, "")
  return (wordBoundary || cleaned.slice(0, imageTitleMaxLength)).trim()
}

function titleFromPrompt(prompt) {
  const normalized = String(prompt ?? "")
    .split(/\r?\n/u)
    .find((line) => line.trim())
  return normalizeImageTitle(normalized) || "Untitled image"
}

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function notFound(message) {
  const error = new Error(message)
  error.statusCode = 404
  return error
}
