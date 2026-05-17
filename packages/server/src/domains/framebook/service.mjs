import { constants as fsConstants } from "node:fs"
import { access, mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { enhancePrompt } from "./enhancer.mjs"
import {
  defaultGeneratedImageMimeType,
  generatedImageExtension,
  imageTitleMaxLength,
  isAspectRatio,
  isGenerationVersionCount,
  maxReferenceImageBytes,
  maxReferenceImages,
  referenceDirName,
  referenceImageExtensions,
  referenceImageMaxSizeLabel,
  referenceImageMimeTypes,
} from "./constants.mjs"
import {
  createImageOptimizer,
  imageVariantMimeType,
  imageVariantWidths,
  isImageVariantWidth,
  variantFileName,
} from "./image-optimizer.mjs"
import { createFramebookStore } from "./storage.mjs"
import {
  buildImageGenerationPrompt,
  createCodexClient,
} from "#infra/agent-clients/codex.mjs"

const defaultMaxParallelImageGenerations = 2

export function createFramebookService({
  store = createFramebookStore(),
  codexClient = createCodexClient(),
  imageOptimizer = createImageOptimizer(),
  autoRunJobs = true,
  maxParallelImageGenerations = readMaxParallelImageGenerations(),
} = {}) {
  const jobRunners = new Map()
  let metadataWriteQueue = Promise.resolve()
  let generationQueueDraining = false
  let generationQueueDrainRequested = false
  let closed = false
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
      defaultAspectRatio: input.defaultAspectRatio
        ? requireAspectRatio(input.defaultAspectRatio)
        : "16:9",
      basePrompt: optionalText(input.basePrompt),
      referenceImages: [],
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
      defaultAspectRatio:
        input.defaultAspectRatio === undefined
          ? current.defaultAspectRatio
          : requireAspectRatio(input.defaultAspectRatio),
      basePrompt:
        input.basePrompt === undefined
          ? current.basePrompt
          : optionalText(input.basePrompt),
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

  async function addTopicReferenceImages(topicId, files) {
    const topics = await store.listTopics()
    const topicIndex = topics.findIndex((topic) => topic.id === topicId)

    if (topicIndex === -1) {
      throw notFound("Topic not found")
    }

    const current = normalizeTopic(topics[topicIndex])
    const referenceFiles = Array.isArray(files) ? files : []

    if (
      current.referenceImages.length + referenceFiles.length >
      maxReferenceImages
    ) {
      throw badRequest(`You can attach up to ${maxReferenceImages} images`)
    }

    const now = new Date().toISOString()
    const referenceImages = await saveReferenceImages({
      topic: current,
      files: referenceFiles,
      createdAt: now,
    })
    const updated = {
      ...current,
      referenceImages: [...current.referenceImages, ...referenceImages],
      updatedAt: now,
    }

    topics[topicIndex] = updated
    await store.writeTopics(topics)
    const images = await listImageRecords()
    return summarizeTopic(updated, images)
  }

  async function deleteTopicReferenceImage(topicId, referenceId) {
    const topics = await store.listTopics()
    const topicIndex = topics.findIndex((topic) => topic.id === topicId)

    if (topicIndex === -1) {
      throw notFound("Topic not found")
    }

    const current = normalizeTopic(topics[topicIndex])
    const referenceImage = current.referenceImages.find(
      (reference) => reference.id === referenceId
    )

    if (!referenceImage) {
      throw notFound("Reference image not found")
    }

    const now = new Date().toISOString()
    const updated = {
      ...current,
      referenceImages: current.referenceImages.filter(
        (reference) => reference.id !== referenceId
      ),
      updatedAt: now,
    }

    topics[topicIndex] = updated
    await store.writeTopics(topics)

    if (!(await isReferenceImageInUse(topicId, referenceImage.fileName))) {
      await removeAssetFile(
        store.getTopicAssetDir(topicId),
        referenceImage.fileName
      )
    }

    const images = await listImageRecords()
    return summarizeTopic(updated, images)
  }

  async function getTopicReferenceImageFile(topicId, referenceId) {
    const topic = await ensureTopic(topicId)
    const referenceImage = topic.referenceImages.find(
      (reference) => reference.id === referenceId
    )

    if (!referenceImage) {
      throw notFound("Reference image not found")
    }

    const filePath = path.join(
      store.getTopicAssetDir(topic.id),
      referenceImage.fileName
    )

    if (!(await fileExists(filePath))) {
      throw notFound("Reference image file not found")
    }

    return {
      filePath,
      mimeType: referenceImage.mimeType,
      referenceImage,
      topic,
    }
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
      researchContext: optionalText(input.researchContext),
      aspectRatio: requireAspectRatio(input.aspectRatio),
      topicSnapshot: snapshotTopic(topic),
      favorite: Boolean(input.favorite),
      archivedAt: input.archivedAt ?? null,
      fileName: requireText(input.fileName, "Image file name is required"),
      mimeType: input.mimeType || defaultGeneratedImageMimeType,
      referenceImages: normalizeReferenceImages(input.referenceImages),
      createdAt: input.createdAt || now,
    }
    record.imageGenerationPrompt = buildStoredImageGenerationPrompt(
      record,
      topic
    )
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
    const enhancedPrompt = await resolveEnhancedPrompt({ rawPrompt })

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
    const enhancedPrompt = optionalText(input.enhancedPrompt) || rawPrompt
    const contextMode = requireResearchContextMode(input.contextMode)
    const topicReferenceImages = resolveTopicReferenceImages(
      topic,
      input.topicReferenceImageIds
    )
    const promptReferenceFiles = Array.isArray(input.referenceImages)
      ? input.referenceImages
      : []

    if (
      topicReferenceImages.length + promptReferenceFiles.length >
      maxReferenceImages
    ) {
      throw badRequest(`You can attach up to ${maxReferenceImages} images`)
    }

    const researchContext = await resolveResearchContext({
      mode: contextMode,
      topic,
      rawPrompt,
      enhancedPrompt,
    })
    const title =
      versionCount > 1
        ? await resolveImageTitle({
            topic,
            rawPrompt,
            enhancedPrompt,
            inputTitle: input.title,
          })
        : resolveInitialImageTitle({
            rawPrompt,
            inputTitle: input.title,
          })
    const batchId = store.createId()
    const now = new Date().toISOString()
    const finalPrompt = buildFinalPrompt({
      enhancedPrompt,
    })
    const createdJobs = []
    const preparedReferenceFiles = []

    for (let index = 0; index < versionCount; index += 1) {
      const jobId = store.createId()
      const promptReferences = await prepareReferenceImages({
        topic,
        files: promptReferenceFiles,
        createdAt: now,
        directorySegments: ["jobs", jobId],
      })
      const referenceImages = [
        ...topicReferenceImages,
        ...promptReferences.map((reference) => reference.referenceImage),
      ]

      preparedReferenceFiles.push(...promptReferences)

      createdJobs.push({
        id: jobId,
        topicId: topic.id,
        status: "queued",
        title: versionCount > 1 ? versionedImageTitle(title, index + 1) : title,
        rawPrompt,
        enhancedPrompt,
        finalPrompt,
        researchContext,
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

    await writePreparedReferenceImages(preparedReferenceFiles)

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
      drainGenerationQueue()
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
      const fileName = `${job.id}${generatedImageExtension}`
      const generated = await codexClient.generateImage({
        prompt: job.finalPrompt,
        aspectRatio: job.aspectRatio,
        topic,
        researchContext: job.researchContext,
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
        researchContext: job.researchContext,
        aspectRatio: job.aspectRatio,
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
    if (!autoRunJobs || closed || jobRunners.has(jobId)) {
      return
    }

    drainGenerationQueue(jobId)
  }

  function drainGenerationQueue() {
    if (!autoRunJobs || closed) {
      return
    }

    if (generationQueueDraining) {
      generationQueueDrainRequested = true
      return
    }

    generationQueueDraining = true
    generationQueueDrainRequested = false
    void Promise.resolve()
      .then(async () => {
        while (!closed && jobRunners.size < maxParallelImageGenerations) {
          const jobId = await nextRunnableGenerationJobId()

          if (!jobId) {
            return
          }

          startGenerationJobRunner(jobId)
        }
      })
      .finally(() => {
        generationQueueDraining = false

        if (generationQueueDrainRequested) {
          drainGenerationQueue()
        }
      })
  }

  function startGenerationJobRunner(jobId) {
    if (jobRunners.has(jobId)) {
      return
    }

    void runGenerationJob(jobId).catch((error) => {
      console.error(
        `[framebook] generation job ${jobId} crashed outside job state`,
        error
      )
    })
  }

  async function nextRunnableGenerationJobId() {
    const jobs = await store.listJobs()
    return jobs
      .map(normalizeGenerationJob)
      .filter((job) => isActiveGenerationJob(job) && !jobRunners.has(job.id))
      .sort(compareRunnableGenerationJobs)[0]?.id
  }

  async function listImagesWithOptimization(shouldOptimize) {
    const images = await listImageRecords()
    return ensureImageOptimizations(images, shouldOptimize)
  }

  async function listImageRecords() {
    const images = await store.listImages()
    return images.map(normalizeImageRecord).map((image) =>
      image.imageGenerationPrompt
        ? image
        : {
            ...image,
            imageGenerationPrompt: buildStoredImageGenerationPrompt(
              image,
              topicForImagePrompt(image)
            ),
          }
    )
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

    return normalizeTopic(topic)
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
    files,
    createdAt = new Date().toISOString(),
  }) {
    const preparedReferences = await prepareReferenceImages({
      topic,
      files,
      createdAt,
      directorySegments: ["topic"],
    })

    await writePreparedReferenceImages(preparedReferences)
    return preparedReferences.map((reference) => reference.referenceImage)
  }

  async function prepareReferenceImages({
    topic,
    files,
    createdAt = new Date().toISOString(),
    directorySegments,
  }) {
    const referenceFiles = Array.isArray(files) ? files : []

    if (referenceFiles.length > maxReferenceImages) {
      throw badRequest(`You can attach up to ${maxReferenceImages} images`)
    }

    const preparedReferences = []

    for (const file of referenceFiles) {
      const mimeType = requireReferenceImageMimeType(file?.mimeType)
      const buffer = requireReferenceImageBuffer(file?.buffer)
      const sizeBytes = Number.isInteger(file?.sizeBytes)
        ? file.sizeBytes
        : buffer.byteLength

      if (sizeBytes > maxReferenceImageBytes) {
        throw badRequest(
          `Reference image must be ${referenceImageMaxSizeLabel} or smaller`
        )
      }

      const id = store.createId()
      const fileName = [
        referenceDirName,
        ...directorySegments.map((segment) => safeReferenceSegment(segment)),
        `${safeReferenceSegment(id)}${referenceImageExtensions[mimeType]}`,
      ].join("/")
      const targetPath = path.join(store.getTopicAssetDir(topic.id), fileName)
      const dimensions = await readReferenceImageDimensions(buffer)

      preparedReferences.push({
        targetPath,
        buffer,
        referenceImage: {
          id,
          fileName,
          originalName: normalizeOriginalFileName(file?.originalName),
          mimeType,
          sizeBytes,
          ...dimensions,
          createdAt,
        },
      })
    }

    return preparedReferences
  }

  async function writePreparedReferenceImages(preparedReferences) {
    for (const reference of preparedReferences) {
      await mkdir(path.dirname(reference.targetPath), { recursive: true })
      await writeFile(reference.targetPath, reference.buffer)
    }
  }

  async function isReferenceImageInUse(topicId, fileName) {
    const [topics, images, jobs] = await Promise.all([
      store.listTopics(),
      listImageRecords(),
      store.listJobs(),
    ])

    return (
      topics
        .filter((topic) => topic.id === topicId)
        .some((topic) =>
          normalizeReferenceImages(topic.referenceImages).some(
            (reference) => reference.fileName === fileName
          )
        ) ||
      images
        .filter((image) => image.topicId === topicId)
        .some((image) =>
          normalizeReferenceImages(image.referenceImages).some(
            (reference) => reference.fileName === fileName
          )
        ) ||
      jobs
        .filter((job) => job.topicId === topicId)
        .some((job) =>
          normalizeReferenceImages(job.referenceImages).some(
            (reference) => reference.fileName === fileName
          )
        )
    )
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

  function buildStoredImageGenerationPrompt(image, topic) {
    return buildImageGenerationPrompt({
      prompt: image.finalPrompt,
      aspectRatio: image.aspectRatio,
      topic,
      researchContext: image.researchContext,
      referenceImages: referenceImagesWithPaths(
        image.topicId,
        image.referenceImages
      ),
      outputPath: path.join(
        store.getTopicAssetDir(image.topicId),
        image.fileName
      ),
    })
  }

  function topicForImagePrompt(image) {
    return normalizeTopic(image.topicSnapshot)
  }

  async function resolveEnhancedPrompt({ rawPrompt }) {
    return typeof codexClient.enhancePrompt === "function"
      ? await codexClient.enhancePrompt({ rawPrompt })
      : enhancePrompt({ rawPrompt })
  }

  async function resolveResearchContext({
    mode,
    topic,
    rawPrompt,
    enhancedPrompt,
  }) {
    if (mode === "none") {
      return ""
    }

    if (typeof codexClient.researchContext !== "function") {
      throw new Error(
        "Research context is not available from the configured Codex client"
      )
    }

    return requireText(
      await codexClient.researchContext({
        topic,
        rawPrompt,
        enhancedPrompt,
      }),
      "Research context is required"
    )
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
    addTopicReferenceImages,
    deleteTopicReferenceImage,
    listImages,
    listStarredImages,
    listArchivedImages,
    addImageRecord,
    updateImage,
    deleteImage,
    getImage,
    getImageFile,
    getTopicReferenceImageFile,
    getReferenceImageFile,
    getImageVariantFile,
    enhanceTopicPrompt,
    createGeneration,
    listGenerationJobs,
    getGenerationJob,
    runGenerationJob,
    async close() {
      closed = true
      if (typeof codexClient.close === "function") {
        await codexClient.close()
      } else if (typeof codexClient.dispose === "function") {
        await codexClient.dispose()
      }

      store.close?.()
    },
  }
}

export function readMaxParallelImageGenerations(env = process.env) {
  const value = Number(env.FRAMEBOOK_MAX_PARALLEL_IMAGE_GENERATIONS)

  return Number.isInteger(value) && value > 0
    ? value
    : defaultMaxParallelImageGenerations
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
  const topicSnapshot = image.topicSnapshot
    ? snapshotTopic(normalizeTopic(image.topicSnapshot))
    : image.topicSnapshot

  return {
    ...image,
    topicSnapshot,
    researchContext: optionalText(image.researchContext),
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

function resolveTopicReferenceImages(topic, topicReferenceImageIds) {
  const referenceImages = normalizeReferenceImages(topic.referenceImages)

  if (topicReferenceImageIds === undefined) {
    return referenceImages
  }

  if (!Array.isArray(topicReferenceImageIds)) {
    throw badRequest("topicReferenceImageIds must be an array")
  }

  const referencesById = new Map(
    referenceImages.map((referenceImage) => [referenceImage.id, referenceImage])
  )
  const selectedReferenceImages = []
  const selectedIds = new Set()

  for (const value of topicReferenceImageIds) {
    const id = optionalText(value)
    const referenceImage = referencesById.get(id)

    if (!id || !referenceImage) {
      throw badRequest("Reference image does not belong to topic")
    }

    if (!selectedIds.has(id)) {
      selectedIds.add(id)
      selectedReferenceImages.push(referenceImage)
    }
  }

  return selectedReferenceImages
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

function compareRunnableGenerationJobs(left, right) {
  const leftStatusPriority = left.status === "running" ? 0 : 1
  const rightStatusPriority = right.status === "running" ? 0 : 1

  if (leftStatusPriority !== rightStatusPriority) {
    return leftStatusPriority - rightStatusPriority
  }

  return left.createdAt.localeCompare(right.createdAt)
}

function normalizeGenerationJob(job) {
  return {
    ...job,
    title: normalizeImageTitle(job.title) || titleFromPrompt(job.rawPrompt),
    researchContext: optionalText(job.researchContext),
    referenceImages: normalizeReferenceImages(job.referenceImages),
  }
}

function summarizeTopic(topic, images) {
  const normalized = normalizeTopic(topic)
  const topicImages = images
    .filter((image) => image.topicId === normalized.id && !image.archivedAt)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const latestImage = topicImages[0] ?? null

  return {
    ...normalized,
    imageCount: topicImages.length,
    favoriteCount: topicImages.filter((image) => image.favorite).length,
    latestImageId: latestImage?.id ?? null,
    latestImageCreatedAt: latestImage?.createdAt ?? null,
  }
}

function normalizeTopic(topic) {
  return {
    ...topic,
    name: optionalText(topic.name),
    defaultAspectRatio: requireAspectRatio(topic.defaultAspectRatio),
    basePrompt: optionalText(topic.basePrompt),
    referenceImages: normalizeReferenceImages(topic.referenceImages),
    archivedAt: topic.archivedAt ?? null,
  }
}

function snapshotTopic(topic) {
  return {
    id: topic.id,
    name: topic.name,
    defaultAspectRatio: topic.defaultAspectRatio,
    basePrompt: topic.basePrompt,
    referenceImages: normalizeReferenceImages(topic.referenceImages),
    archivedAt: topic.archivedAt ?? null,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
    imageCount: Number.isInteger(topic.imageCount) ? topic.imageCount : 0,
    favoriteCount: Number.isInteger(topic.favoriteCount)
      ? topic.favoriteCount
      : 0,
    latestImageId: topic.latestImageId ?? null,
    latestImageCreatedAt: topic.latestImageCreatedAt ?? null,
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

function requireGenerationVersionCount(value) {
  const count = value === undefined ? 1 : Number(value)

  if (!Number.isInteger(count) || !isGenerationVersionCount(count)) {
    throw badRequest("Generation version count must be 1, 2, or 4")
  }

  return count
}

function requireResearchContextMode(value) {
  const mode = optionalText(value) || "none"

  if (mode === "none" || mode === "web") {
    return mode
  }

  throw badRequest("Research context mode must be none or web")
}

function buildFinalPrompt({ enhancedPrompt }) {
  return enhancedPrompt
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

function versionedImageTitle(title, versionIndex) {
  const suffix = ` v${versionIndex}`
  const baseTitle = normalizeImageTitle(title) || "Untitled image"

  if (baseTitle.length + suffix.length <= imageTitleMaxLength) {
    return `${baseTitle}${suffix}`
  }

  const maxBaseLength = imageTitleMaxLength - suffix.length
  const wordBoundary = baseTitle.slice(0, maxBaseLength).replace(/\s+\S*$/u, "")
  const truncatedBase = (wordBoundary || baseTitle.slice(0, maxBaseLength))
    .replace(/[|,;:./\-\s]+$/gu, "")
    .trim()

  return `${truncatedBase || "Untitled image"}${suffix}`
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
