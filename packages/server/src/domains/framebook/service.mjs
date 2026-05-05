import { constants as fsConstants } from "node:fs"
import { access, mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { enhancePrompt } from "./enhancer.mjs"
import {
  isAspectRatio,
  isEnhancerMode,
  isGenerationVersionCount,
} from "./constants.mjs"
import {
  createImageOptimizer,
  imageVariantMimeType,
  imageVariantWidths,
  isImageVariantWidth,
  variantFileName,
} from "./image-optimizer.mjs"
import { createFramebookStore } from "./storage.mjs"
import { createCodexClient } from "#infra/agent-clients/codex.mjs"

const imageTitleMaxLength = 60
const referenceDirName = "references"
const maxReferenceImages = 5
const maxReferenceImageBytes = 10 * 1024 * 1024
const referenceImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
])
const referenceImageExtensions = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}

export function createFramebookService({
  store = createFramebookStore(),
  codexClient = createCodexClient(),
  imageOptimizer = createImageOptimizer(),
  autoRunJobs = true,
} = {}) {
  const jobRunners = new Map()
  let metadataWriteQueue = Promise.resolve()
  prewarmImageGenerator(codexClient)
  prewarmPromptEnhancer(codexClient)

  async function listTopics({ includeArchived = false } = {}) {
    const [topics, images] = await Promise.all([
      store.listTopics(),
      listImageRecords(),
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

    const images = await listImageRecords()
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
    const images = await listImageRecords()
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
    const images = await listImageRecords()
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
    const images = await listImageRecords()
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
      listImageRecords(),
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
    const images = await listImageRecords()
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
      referenceImages: normalizeReferenceImages(input.referenceImages),
      createdAt: input.createdAt || now,
    }
    const optimizedRecord = await maybeOptimizeImageRecord(record)

    await withMetadataWriteLock(async () => {
      const [topics, images] = await Promise.all([
        store.listTopics(),
        listImageRecords(),
      ])
      await store.writeImages([...images, optimizedRecord])
      await touchTopic(topics, topic.id, optimizedRecord.createdAt)
    })
    return optimizedRecord
  }

  async function updateImage(imageId, input) {
    const images = await listImageRecords()
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

  async function deleteImage(imageId) {
    const [topics, images, jobs] = await Promise.all([
      store.listTopics(),
      listImageRecords(),
      store.listJobs(),
    ])
    const image = images.find((candidate) => candidate.id === imageId)

    if (!image) {
      throw notFound("Image not found")
    }

    await deleteImageFiles(image, store.getTopicAssetDir(image.topicId))
    await store.writeImages(
      images.filter((candidate) => candidate.id !== image.id)
    )

    const now = new Date().toISOString()
    const updatedJobs = jobs.map((job) =>
      job.imageId === image.id ? { ...job, imageId: null, updatedAt: now } : job
    )
    if (updatedJobs.some((job, index) => job !== jobs[index])) {
      await store.writeJobs(updatedJobs)
    }

    await touchTopic(topics, image.topicId, now)
    return { deleted: true, imageId: image.id }
  }

  async function getImage(imageId) {
    const images = await listImageRecords()
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

  async function getReferenceImageFile(imageId, referenceId) {
    const image = await getImage(imageId)
    const referenceImage = image.referenceImages.find(
      (reference) => reference.id === referenceId
    )

    if (!referenceImage) {
      throw notFound("Reference image not found")
    }

    const filePath = path.join(
      store.getTopicAssetDir(image.topicId),
      referenceImage.fileName
    )

    if (!(await fileExists(filePath))) {
      throw notFound("Reference image file not found")
    }

    return {
      filePath,
      mimeType: referenceImage.mimeType,
      referenceImage,
      image,
    }
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
    const versionCount = requireGenerationVersionCount(input.versionCount)
    const enhancedPrompt =
      optionalText(input.enhancedPrompt) ||
      (await resolveEnhancedPrompt({ topic, rawPrompt }))
    const title = resolveInitialImageTitle({
      rawPrompt,
      inputTitle: input.title,
    })
    const batchId = store.createId()
    const now = new Date().toISOString()
    const finalPrompt = buildFinalPrompt({
      enhancedPrompt,
      aspectRatio,
    })
    const createdJobs = []

    for (let index = 0; index < versionCount; index += 1) {
      const jobId = store.createId()
      const referenceImages = await saveReferenceImages({
        topic,
        jobId,
        files: input.referenceImages,
        createdAt: now,
      })

      createdJobs.push({
        id: jobId,
        topicId: topic.id,
        status: "queued",
        title,
        rawPrompt,
        enhancedPrompt,
        finalPrompt,
        aspectRatio,
        referenceImages,
        imageId: null,
        error: null,
        batchId,
        versionIndex: index + 1,
        versionCount,
        createdAt: now,
        updatedAt: now,
      })
    }

    await withMetadataWriteLock(async () => {
      const jobs = await store.listJobs()
      await store.writeJobs([...jobs, ...createdJobs])
    })

    if (autoRunJobs) {
      for (const job of createdJobs) {
        startGenerationJob(job.id)
      }
    }

    return Object.defineProperty({ ...createdJobs[0] }, "jobs", {
      value: createdJobs,
      enumerable: false,
    })
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
      const title = await resolveGeneratedImageTitle({ topic, job })
      if (title !== job.title) {
        job = await updateJob(job.id, {
          title,
          updatedAt: new Date().toISOString(),
        })
      }

      const outputDir = store.getTopicAssetDir(topic.id)
      const fileName = `${job.id}.png`
      const generated = await codexClient.generateImage({
        prompt: job.finalPrompt,
        rawPrompt: job.rawPrompt,
        aspectRatio: job.aspectRatio,
        topic,
        referenceImages: referenceImagesWithPaths(
          topic.id,
          job.referenceImages
        ),
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
        referenceImages: job.referenceImages,
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
    const images = await listImageRecords()
    return ensureImageOptimizations(images, shouldOptimize)
  }

  async function listImageRecords() {
    return (await store.listImages()).map(normalizeImageRecord)
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
    const images = await listImageRecords()
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

  async function withMetadataWriteLock(operation) {
    const queuedOperation = metadataWriteQueue.then(operation, operation)
    metadataWriteQueue = queuedOperation.catch(() => {})
    return queuedOperation
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
    await withMetadataWriteLock(async () => {
      const latestJobs = await store.listJobs()
      const latestIndex = latestJobs.findIndex(
        (candidate) => candidate.id === jobId
      )

      if (latestIndex === -1) {
        throw notFound("Generation job not found")
      }

      latestJobs[latestIndex] = { ...latestJobs[latestIndex], ...patch }
      await store.writeJobs(latestJobs)
    })
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

  async function saveReferenceImages({
    topic,
    jobId,
    files,
    createdAt = new Date().toISOString(),
  }) {
    const referenceFiles = Array.isArray(files) ? files : []

    if (referenceFiles.length > maxReferenceImages) {
      throw badRequest(`You can attach up to ${maxReferenceImages} images`)
    }

    const referenceImages = []

    for (const file of referenceFiles) {
      const mimeType = requireReferenceImageMimeType(file?.mimeType)
      const buffer = requireReferenceImageBuffer(file?.buffer)
      const sizeBytes = Number.isInteger(file?.sizeBytes)
        ? file.sizeBytes
        : buffer.byteLength

      if (sizeBytes > maxReferenceImageBytes) {
        throw badRequest("Reference image must be 10 MB or smaller")
      }

      const id = store.createId()
      const fileName = [
        referenceDirName,
        safeReferenceSegment(jobId),
        `${safeReferenceSegment(id)}${referenceImageExtensions[mimeType]}`,
      ].join("/")
      const targetPath = path.join(store.getTopicAssetDir(topic.id), fileName)
      const dimensions = await readReferenceImageDimensions(buffer)

      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, buffer)

      referenceImages.push({
        id,
        fileName,
        originalName: normalizeOriginalFileName(file?.originalName),
        mimeType,
        sizeBytes,
        ...dimensions,
        createdAt,
      })
    }

    return referenceImages
  }

  function referenceImagesWithPaths(topicId, referenceImages) {
    return normalizeReferenceImages(referenceImages).map((referenceImage) => ({
      ...referenceImage,
      filePath: path.join(
        store.getTopicAssetDir(topicId),
        referenceImage.fileName
      ),
    }))
  }

  async function resolveEnhancedPrompt({ topic, rawPrompt }) {
    return typeof codexClient.enhancePrompt === "function"
      ? await codexClient.enhancePrompt({ topic, rawPrompt })
      : enhancePrompt({ topic, rawPrompt })
  }

  function resolveInitialImageTitle({ rawPrompt, inputTitle }) {
    return (
      normalizeImageTitle(inputTitle) ||
      extractExplicitTitleFromPrompt(rawPrompt) ||
      titleFromPrompt(rawPrompt)
    )
  }

  async function resolveGeneratedImageTitle({ topic, job }) {
    if (!shouldGenerateImageTitle(job)) {
      return job.title
    }

    return resolveImageTitle({
      topic,
      rawPrompt: job.rawPrompt,
      enhancedPrompt: job.enhancedPrompt,
      inputTitle: null,
    })
  }

  function shouldGenerateImageTitle(job) {
    const title = normalizeImageTitle(job.title)
    const explicitTitle = extractExplicitTitleFromPrompt(job.rawPrompt)

    if (explicitTitle && title === explicitTitle) {
      return false
    }

    return title === titleFromPrompt(job.rawPrompt)
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
    deleteImage,
    getImage,
    getImageFile,
    getReferenceImageFile,
    getImageVariantFile,
    enhanceTopicPrompt,
    createGeneration,
    listGenerationJobs,
    getGenerationJob,
    runGenerationJob,
    async close() {
      if (typeof codexClient.close === "function") {
        await codexClient.close()
      } else if (typeof codexClient.dispose === "function") {
        await codexClient.dispose()
      }

      store.close?.()
    },
  }
}

function prewarmPromptEnhancer(codexClient) {
  if (typeof codexClient.prewarmEnhancer !== "function") {
    return
  }

  void Promise.resolve()
    .then(() => codexClient.prewarmEnhancer())
    .catch((error) => {
      console.warn(
        `[framebook] prompt enhancer prewarm failed; the next Enhance request will retry: ${errorMessage(
          error
        )}`
      )
    })
}

function prewarmImageGenerator(codexClient) {
  if (typeof codexClient.prewarmImageGenerator !== "function") {
    return
  }

  void Promise.resolve()
    .then(() => codexClient.prewarmImageGenerator())
    .catch((error) => {
      console.warn(
        `[framebook] image generator prewarm failed; the next Generate request will retry: ${errorMessage(
          error
        )}`
      )
    })
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function normalizeImageRecord(image) {
  return {
    ...image,
    referenceImages: normalizeReferenceImages(image.referenceImages),
  }
}

function normalizeReferenceImages(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((reference) => {
      const id = optionalText(reference?.id)
      const fileName = optionalText(reference?.fileName)
      const mimeType = reference?.mimeType

      if (!id || !fileName || !referenceImageMimeTypes.has(mimeType)) {
        return null
      }

      return {
        id,
        fileName,
        originalName: normalizeOriginalFileName(reference.originalName),
        mimeType,
        sizeBytes: Number.isInteger(reference.sizeBytes)
          ? reference.sizeBytes
          : 0,
        ...(Number.isInteger(reference.width) && reference.width > 0
          ? { width: reference.width }
          : {}),
        ...(Number.isInteger(reference.height) && reference.height > 0
          ? { height: reference.height }
          : {}),
        createdAt:
          optionalText(reference.createdAt) || new Date(0).toISOString(),
      }
    })
    .filter(Boolean)
}

function requireReferenceImageMimeType(value) {
  const mimeType = String(value ?? "").toLowerCase()

  if (!referenceImageMimeTypes.has(mimeType)) {
    throw badRequest("Reference image must be a PNG, JPEG, or WebP file")
  }

  return mimeType
}

function requireReferenceImageBuffer(value) {
  if (!Buffer.isBuffer(value) || value.byteLength === 0) {
    throw badRequest("Reference image file is required")
  }

  return value
}

async function readReferenceImageDimensions(buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      ...(Number.isInteger(metadata.width) && metadata.width > 0
        ? { width: metadata.width }
        : {}),
      ...(Number.isInteger(metadata.height) && metadata.height > 0
        ? { height: metadata.height }
        : {}),
    }
  } catch (error) {
    throw badRequest(
      `Reference image could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

function normalizeOriginalFileName(value) {
  return (
    path
      .basename(String(value ?? "reference image"))
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 180) || "reference image"
  )
}

function safeReferenceSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_")
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

async function deleteImageFiles(image, topicAssetDir) {
  const assetDir = path.resolve(topicAssetDir)
  const fileNames = new Set([
    image.fileName,
    ...imageVariantWidths.map((width) =>
      variantFileName(image.fileName, width)
    ),
    ...(Array.isArray(image.variants)
      ? image.variants.map((variant) => variant.fileName)
      : []),
    ...normalizeReferenceImages(image.referenceImages).map(
      (referenceImage) => referenceImage.fileName
    ),
  ])

  await Promise.all(
    [...fileNames]
      .filter(Boolean)
      .map((fileName) => removeAssetFile(assetDir, fileName))
  )
}

async function removeAssetFile(assetDir, fileName) {
  const filePath = path.resolve(assetDir, fileName)

  if (!filePath.startsWith(`${assetDir}${path.sep}`)) {
    throw badRequest("Invalid image file path")
  }

  await rm(filePath, { force: true })
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
    referenceImages: normalizeReferenceImages(job.referenceImages),
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

function requireGenerationVersionCount(value) {
  const count = value === undefined ? 1 : Number(value)

  if (!Number.isInteger(count) || !isGenerationVersionCount(count)) {
    throw badRequest("Generation version count must be 1, 2, or 4")
  }

  return count
}

function buildFinalPrompt({ enhancedPrompt, aspectRatio }) {
  return [
    enhancedPrompt,
    "",
    "Generation requirements:",
    `- Aspect ratio: ${aspectRatio}`,
  ].join("\n")
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
