import { access, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createFramebookService } from "../src/domains/framebook/service.mjs"
import { createFramebookStore } from "../src/domains/framebook/storage.mjs"
import {
  buildImageGenerationPrompt,
  buildPromptEnhancementPrompt,
  createFakeCodexClient,
} from "../src/infrastructure/agent-clients/codex.mjs"

describe("framebook service", () => {
  let dataDir
  let service

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "framebook-test-"))
    service = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: createFakeCodexClient(),
      autoRunJobs: false,
    })
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it("creates, lists, updates, archives, and unarchives topics", async () => {
    const topic = await service.createTopic({
      name: "Travel Poster Study",
      description: "Swiss Alps poster experiments",
      instruction:
        "Use cinematic travel poster style with bold typography space.",
      defaultAspectRatio: "16:9",
      basePromptDetails: "Snowy peaks, rail viaduct, crisp morning light",
      enhancerMode: "balanced",
    })

    expect(topic.name).toBe("Travel Poster Study")
    expect(topic.imageCount).toBe(0)

    const updated = await service.updateTopic(topic.id, {
      name: "Swiss Alps Posters",
      enhancerMode: "storyboard",
    })

    expect(updated.name).toBe("Swiss Alps Posters")
    expect(updated.enhancerMode).toBe("storyboard")

    const activeTopics = await service.listTopics()
    expect(activeTopics).toHaveLength(1)

    const archived = await service.archiveTopic(topic.id)
    expect(archived.archivedAt).toEqual(expect.any(String))

    expect(await service.listTopics()).toHaveLength(0)
    expect(await service.getTopic(topic.id)).toMatchObject({
      id: topic.id,
      name: "Swiss Alps Posters",
    })

    const unarchived = await service.unarchiveTopic(topic.id)
    expect(unarchived.archivedAt).toBeNull()
    expect(await service.listTopics()).toHaveLength(1)
  })

  it("handles concurrent first reads while initializing local metadata", async () => {
    const freshService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: createFakeCodexClient(),
      autoRunJobs: false,
    })

    await expect(
      Promise.all([freshService.listTopics(), freshService.listTopics()])
    ).resolves.toEqual([[], []])
  })

  it("stores metadata in a local sqlite database inside the workspace", async () => {
    const topic = await createTopic(service)

    await expect(
      access(path.join(dataDir, "framebook.db"))
    ).resolves.toBeUndefined()
    await expect(service.getTopic(topic.id)).resolves.toMatchObject({
      id: topic.id,
      name: "Monsoon Trip Story",
    })
  })

  it("creates and lists image records with a generation-time topic snapshot", async () => {
    const topic = await createTopic(service)
    const image = await service.addImageRecord({
      topicId: topic.id,
      rawPrompt: "Rainy scooter ride through coffee estate",
      enhancedPrompt: "Enhanced rainy scooter ride through coffee estate.",
      finalPrompt: "Enhanced rainy scooter ride through coffee estate.",
      aspectRatio: "4:3",
      enhancerMode: "doodle-explainer",
      fileName: "scooter.svg",
      mimeType: "image/svg+xml",
      favorite: true,
    })

    const images = await service.listImages(topic.id)
    expect(images).toEqual([image])
    expect(images[0].topicSnapshot).toMatchObject({
      id: topic.id,
      instruction: topic.instruction,
    })
    expect(images[0].archivedAt).toBeNull()

    const topics = await service.listTopics()
    expect(topics[0]).toMatchObject({
      imageCount: 1,
      favoriteCount: 1,
      latestImageId: image.id,
    })
  })

  it("archives individual images without deleting their records", async () => {
    const topic = await createTopic(service)
    const image = await service.addImageRecord({
      topicId: topic.id,
      rawPrompt: "Rainy scooter ride through coffee estate",
      enhancedPrompt: "Enhanced rainy scooter ride through coffee estate.",
      finalPrompt: "Enhanced rainy scooter ride through coffee estate.",
      aspectRatio: "4:3",
      enhancerMode: "doodle-explainer",
      fileName: "scooter.svg",
      mimeType: "image/svg+xml",
      favorite: true,
    })

    const archived = await service.updateImage(image.id, { archived: true })

    expect(archived.archivedAt).toEqual(expect.any(String))
    await expect(service.listImages(topic.id)).resolves.toHaveLength(0)
    await expect(service.getImage(image.id)).resolves.toMatchObject({
      id: image.id,
      archivedAt: archived.archivedAt,
    })
    await expect(service.listTopics()).resolves.toMatchObject([
      {
        id: topic.id,
        imageCount: 0,
        favoriteCount: 0,
        latestImageId: null,
      },
    ])
  })

  it("lists starred images across active topics only", async () => {
    const firstTopic = await createTopic(service)
    const secondTopic = await service.createTopic({
      name: "Market Food",
      description: "Street food references.",
      instruction: "Warm editorial food photography.",
      defaultAspectRatio: "1:1",
      basePromptDetails: "",
      enhancerMode: "brand-product",
    })
    const archivedTopic = await service.createTopic({
      name: "Archived Ideas",
      description: "",
      instruction: "Old references.",
      defaultAspectRatio: "16:9",
      basePromptDetails: "",
      enhancerMode: "balanced",
    })
    await service.archiveTopic(archivedTopic.id)

    const firstStarred = await service.addImageRecord({
      topicId: firstTopic.id,
      rawPrompt: "Rainy scooter ride through coffee estate",
      enhancedPrompt: "Enhanced rainy scooter ride through coffee estate.",
      finalPrompt: "Enhanced rainy scooter ride through coffee estate.",
      aspectRatio: "4:3",
      enhancerMode: "doodle-explainer",
      fileName: "scooter.svg",
      mimeType: "image/svg+xml",
      favorite: true,
      createdAt: "2026-05-04T10:00:00.000Z",
    })
    const newestStarred = await service.addImageRecord({
      topicId: secondTopic.id,
      rawPrompt: "Steaming momos on a market stall",
      enhancedPrompt: "Enhanced steaming momos on a market stall.",
      finalPrompt: "Enhanced steaming momos on a market stall.",
      aspectRatio: "1:1",
      enhancerMode: "brand-product",
      fileName: "momos.svg",
      mimeType: "image/svg+xml",
      favorite: true,
      createdAt: "2026-05-04T11:00:00.000Z",
    })
    await service.addImageRecord({
      topicId: firstTopic.id,
      rawPrompt: "Unstarred tea garden",
      enhancedPrompt: "Enhanced unstarred tea garden.",
      finalPrompt: "Enhanced unstarred tea garden.",
      aspectRatio: "4:3",
      enhancerMode: "storyboard",
      fileName: "tea.svg",
      mimeType: "image/svg+xml",
      favorite: false,
    })
    await service.addImageRecord({
      topicId: archivedTopic.id,
      rawPrompt: "Archived topic image",
      enhancedPrompt: "Enhanced archived topic image.",
      finalPrompt: "Enhanced archived topic image.",
      aspectRatio: "16:9",
      enhancerMode: "balanced",
      fileName: "archived.svg",
      mimeType: "image/svg+xml",
      favorite: true,
    })

    await expect(service.listStarredImages()).resolves.toEqual([
      newestStarred,
      firstStarred,
    ])
  })

  it("enhances prompts with topic context, mode guidance, and aspect ratio", async () => {
    const topic = await createTopic(service)
    const result = await service.enhanceTopicPrompt(topic.id, {
      rawPrompt: "Morning tea stall in misty hills",
      aspectRatio: "16:9",
    })

    expect(result.enhancedPrompt).toContain("Morning tea stall in misty hills")
    expect(result.enhancedPrompt).toContain(topic.instruction)
    expect(result.enhancedPrompt).toContain("storytelling clarity")
    expect(result.enhancedPrompt).toContain("Aspect ratio: 16:9")
  })

  it("uses codex app-server client when enhancing prompts", async () => {
    const codexEnhancedPrompt =
      "Photorealistic morning tea stall prompt with clear constraints."
    const codexService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        async enhancePrompt() {
          return codexEnhancedPrompt
        },
      },
      autoRunJobs: false,
    })
    const topic = await createTopic(codexService)

    await expect(
      codexService.enhanceTopicPrompt(topic.id, {
        rawPrompt: "Morning tea stall",
        aspectRatio: "16:9",
      })
    ).resolves.toMatchObject({
      enhancedPrompt: codexEnhancedPrompt,
    })
  })

  it("runs a generation job and saves the generated file and image metadata", async () => {
    const topic = await createTopic(service)
    const job = await service.createGeneration(topic.id, {
      rawPrompt: "A red train crossing a stone viaduct in the Swiss Alps",
      aspectRatio: "16:9",
    })

    expect(job.status).toBe("queued")

    const finishedJob = await service.runGenerationJob(job.id)
    expect(finishedJob.status).toBe("succeeded")
    expect(finishedJob.imageId).toEqual(expect.any(String))

    const images = await service.listImages(topic.id)
    expect(images).toHaveLength(1)
    expect(images[0]).toMatchObject({
      generationJobId: job.id,
      rawPrompt: "A red train crossing a stone viaduct in the Swiss Alps",
      aspectRatio: "16:9",
      fileName: `${job.id}.png`,
      mimeType: "image/png",
    })

    const { filePath } = await service.getImageFile(images[0].id)
    await expect(access(filePath)).resolves.toBeUndefined()
  })

  it("lists active generation jobs for a topic", async () => {
    const topic = await createTopic(service)
    const job = await service.createGeneration(topic.id, {
      rawPrompt: "A rainy hill station market at dusk",
      aspectRatio: "4:3",
    })

    await expect(
      service.listGenerationJobs(topic.id, { activeOnly: true })
    ).resolves.toEqual([job])
  })

  it("continues auto-started generation jobs without a client poller", async () => {
    const fakeCodexClient = createFakeCodexClient()
    const autoService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        async generateImage(input) {
          await sleep(20)
          return fakeCodexClient.generateImage(input)
        },
      },
      autoRunJobs: true,
    })
    const topic = await createTopic(autoService)

    const job = await autoService.createGeneration(topic.id, {
      rawPrompt: "A red train crossing a stone viaduct in the Swiss Alps",
      aspectRatio: "16:9",
    })

    expect(job.status).toBe("queued")

    const finishedJob = await waitForJobStatus(autoService, job.id, "succeeded")
    expect(finishedJob.imageId).toEqual(expect.any(String))
    await expect(autoService.listImages(topic.id)).resolves.toHaveLength(1)
  })

  it("does not rerun terminal generation jobs", async () => {
    const topic = await createTopic(service)
    const job = await service.createGeneration(topic.id, {
      rawPrompt: "A quiet mountain station platform",
      aspectRatio: "16:9",
    })

    await service.runGenerationJob(job.id)
    await service.runGenerationJob(job.id)

    await expect(service.listImages(topic.id)).resolves.toHaveLength(1)
  })

  it("builds the codex app-server prompt with a real image output contract", async () => {
    const topic = await createTopic(service)
    const outputPath = path.join(dataDir, "images", topic.id, "image.png")
    const prompt = buildImageGenerationPrompt({
      prompt: "Final cinematic tea stall prompt",
      rawPrompt: "Morning tea stall",
      aspectRatio: "16:9",
      topic,
      outputPath,
    })

    expect(prompt).toContain("image creation skill/tool")
    expect(prompt).toContain("Do not create a placeholder")
    expect(prompt).toContain("Aspect ratio: 16:9")
    expect(prompt).toContain("Morning tea stall")
    expect(prompt).toContain("Final cinematic tea stall prompt")
    expect(prompt).toContain(outputPath)
  })

  it("builds the codex app-server prompt enhancement contract", async () => {
    const topic = await createTopic(service)
    const prompt = buildPromptEnhancementPrompt({
      topic,
      rawPrompt: "A product photo of a ceramic mug",
      aspectRatio: "1:1",
    })

    expect(prompt).toContain("OpenAI GPT image generation models")
    expect(prompt).toContain("Return only the final enhanced prompt")
    expect(prompt).toContain("photorealistic")
    expect(prompt).toContain("no watermark")
    expect(prompt).toContain("A product photo of a ceramic mug")
    expect(prompt).toContain("Aspect ratio: 1:1")
  })

  it("marks generation jobs failed without losing prompt context", async () => {
    const failingService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        async generateImage() {
          throw new Error("image skill unavailable")
        },
      },
      autoRunJobs: false,
    })
    const topic = await createTopic(failingService)
    const job = await failingService.createGeneration(topic.id, {
      rawPrompt: "A calm product hero image",
      aspectRatio: "16:9",
    })

    const failedJob = await failingService.runGenerationJob(job.id)

    expect(failedJob).toMatchObject({
      status: "failed",
      rawPrompt: "A calm product hero image",
      error: "image skill unavailable",
    })
    expect(await failingService.listImages(topic.id)).toHaveLength(0)
  })
})

async function createTopic(service) {
  return service.createTopic({
    name: "Monsoon Trip Story",
    description: "A 5-image illustrated story about a rainy hill-station trip.",
    instruction:
      "Warm hand-drawn travel journal with expressive travelers, earthy colors, gentle rain, and minimal clutter.",
    defaultAspectRatio: "4:3",
    basePromptDetails:
      "Two travelers, one small backpack, recurring red scooter, misty hills",
    enhancerMode: "storyboard",
  })
}

async function waitForJobStatus(service, jobId, status) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const job = await service.getGenerationJob(jobId)

    if (job.status === status) {
      return job
    }

    await sleep(10)
  }

  throw new Error(`Generation job ${jobId} did not reach ${status}`)
}
