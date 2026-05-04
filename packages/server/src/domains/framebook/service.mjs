import path from "node:path"
import { enhancePrompt } from "./enhancer.mjs"
import { isAspectRatio, isEnhancerMode } from "./constants.mjs"
import { createFramebookStore } from "./storage.mjs"
import { createCodexClient } from "#infra/agent-clients/codex.mjs"

const resolutionPresets = new Set(["1k", "2k", "4k"])

export function createFramebookService({
  store = createFramebookStore(),
  codexClient = createCodexClient(),
  autoRunJobs = true,
} = {}) {
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
    const images = await store.listImages()
    return images
      .filter((image) => image.topicId === topicId)
      .filter((image) => !favoriteOnly || image.favorite)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async function addImageRecord(input) {
    const topic = await ensureTopic(input.topicId)
    const now = new Date().toISOString()
    const record = {
      id: input.id || store.createId(),
      topicId: topic.id,
      generationJobId: input.generationJobId ?? null,
      title: titleFromPrompt(input.rawPrompt),
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
      fileName: requireText(input.fileName, "Image file name is required"),
      mimeType: input.mimeType || "image/png",
      createdAt: input.createdAt || now,
    }

    const [topics, images] = await Promise.all([
      store.listTopics(),
      store.listImages(),
    ])
    await store.writeImages([...images, record])
    await touchTopic(topics, topic.id, record.createdAt)
    return record
  }

  async function updateImage(imageId, input) {
    const images = await store.listImages()
    const imageIndex = images.findIndex((image) => image.id === imageId)

    if (imageIndex === -1) {
      throw notFound("Image not found")
    }

    const updated = {
      ...images[imageIndex],
      favorite:
        input.favorite === undefined
          ? images[imageIndex].favorite
          : Boolean(input.favorite),
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

    return image
  }

  async function getImageFile(imageId) {
    const image = await getImage(imageId)
    const filePath = path.join(
      store.getTopicAssetDir(image.topicId),
      image.fileName
    )
    return { filePath, mimeType: image.mimeType, image }
  }

  async function enhanceTopicPrompt(topicId, input) {
    const topic = await ensureTopic(topicId)
    const rawPrompt = requireText(input.rawPrompt, "Raw prompt is required")
    const aspectRatio = input.aspectRatio
      ? requireAspectRatio(input.aspectRatio)
      : topic.defaultAspectRatio
    const enhancedPrompt =
      typeof codexClient.enhancePrompt === "function"
        ? await codexClient.enhancePrompt({ topic, rawPrompt, aspectRatio })
        : enhancePrompt({ topic, rawPrompt, aspectRatio })

    return {
      rawPrompt,
      enhancedPrompt,
      aspectRatio,
    }
  }

  async function createGeneration(topicId, input) {
    const topic = await ensureTopic(topicId)
    const rawPrompt = requireText(input.rawPrompt, "Raw prompt is required")
    const aspectRatio = input.aspectRatio
      ? requireAspectRatio(input.aspectRatio)
      : topic.defaultAspectRatio
    const enhancedPrompt =
      optionalText(input.enhancedPrompt) ||
      enhancePrompt({ topic, rawPrompt, aspectRatio })
    const now = new Date().toISOString()
    const job = {
      id: store.createId(),
      topicId: topic.id,
      status: "queued",
      rawPrompt,
      enhancedPrompt,
      finalPrompt: enhancedPrompt,
      aspectRatio,
      resolutionPreset: requireResolutionPreset(input.resolutionPreset),
      imageId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }

    const jobs = await store.listJobs()
    await store.writeJobs([...jobs, job])

    if (autoRunJobs) {
      setTimeout(() => {
        runGenerationJob(job.id).catch((error) => {
          console.error(error)
        })
      }, 0)
    }

    return job
  }

  async function getGenerationJob(jobId) {
    const jobs = await store.listJobs()
    const job = jobs.find((candidate) => candidate.id === jobId)

    if (!job) {
      throw notFound("Generation job not found")
    }

    return job
  }

  async function runGenerationJob(jobId) {
    let job = await updateJob(jobId, {
      status: "running",
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
    addImageRecord,
    updateImage,
    getImage,
    getImageFile,
    enhanceTopicPrompt,
    createGeneration,
    getGenerationJob,
    runGenerationJob,
  }
}

function summarizeTopic(topic, images) {
  const topicImages = images
    .filter((image) => image.topicId === topic.id)
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

function titleFromPrompt(prompt) {
  const normalized = String(prompt).replace(/\s+/g, " ").trim()
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized
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
