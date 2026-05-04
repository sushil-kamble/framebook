import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHttpServer } from "../src/app/http-server.mjs"
import { setFramebookServiceForTesting } from "../src/app/router.mjs"
import { createFramebookService } from "../src/domains/framebook/service.mjs"
import { createFramebookStore } from "../src/domains/framebook/storage.mjs"
import {
  buildImageTitlePrompt,
  buildImageGenerationPrompt,
  buildPromptEnhancementPrompt,
  CodexAppServerImageClient,
  createFakeCodexClient,
} from "../src/infrastructure/agent-clients/codex.mjs"

describe("framebook service", () => {
  let dataDir
  let store
  let service

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "framebook-test-"))
    store = createFramebookStore({ dataDir })
    service = createFramebookService({
      store,
      codexClient: createFakeCodexClient(),
      autoRunJobs: false,
    })
  })

  afterEach(async () => {
    setFramebookServiceForTesting(undefined)
    store?.close()
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

  it("lists archived images newest archive first", async () => {
    const topic = await createTopic(service)
    const firstImage = await service.addImageRecord({
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
    const secondImage = await service.addImageRecord({
      topicId: topic.id,
      rawPrompt: "Steaming tea stall",
      enhancedPrompt: "Enhanced steaming tea stall.",
      finalPrompt: "Enhanced steaming tea stall.",
      aspectRatio: "16:9",
      enhancerMode: "balanced",
      fileName: "tea.svg",
      mimeType: "image/svg+xml",
      favorite: false,
    })

    const firstArchived = await service.updateImage(firstImage.id, {
      archived: true,
    })
    await sleep(2)
    const secondArchived = await service.updateImage(secondImage.id, {
      archived: true,
    })

    await expect(service.listArchivedImages()).resolves.toEqual([
      secondArchived,
      firstArchived,
    ])

    const restored = await service.updateImage(firstImage.id, {
      archived: false,
    })
    expect(restored.archivedAt).toBeNull()
    await expect(service.listArchivedImages()).resolves.toEqual([
      secondArchived,
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

  it("enhances prompts without injecting output settings or quality language", async () => {
    const topic = await createTopic(service)
    const result = await service.enhanceTopicPrompt(topic.id, {
      rawPrompt: "Morning tea stall in misty hills",
      aspectRatio: "16:9",
    })

    expect(result.enhancedPrompt).toContain("Morning tea stall in misty hills")
    expect(result.enhancedPrompt).toContain(topic.instruction)
    expect(result.enhancedPrompt).toContain("storytelling clarity")
    expect(result.enhancedPrompt).not.toMatch(
      /aspect ratio|16:9|resolution|quality/iu
    )
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
    expect(job.title).toBe(
      "A red train crossing a stone viaduct in the Swiss Alps"
    )
    expect(job.finalPrompt).toContain("Aspect ratio: 16:9")
    expect(job.finalPrompt).toContain("Output resolution: 1K")

    const finishedJob = await service.runGenerationJob(job.id)
    expect(finishedJob.status).toBe("succeeded")
    expect(finishedJob.imageId).toEqual(expect.any(String))

    const images = await service.listImages(topic.id)
    expect(images).toHaveLength(1)
    expect(images[0]).toMatchObject({
      generationJobId: job.id,
      title: job.title,
      rawPrompt: "A red train crossing a stone viaduct in the Swiss Alps",
      aspectRatio: "16:9",
      fileName: `${job.id}.png`,
      mimeType: "image/png",
      width: 1,
      height: 1,
      placeholderColor: expect.stringMatching(/^#[0-9a-f]{6}$/u),
    })
    expect(images[0].variants).toHaveLength(4)
    expect(images[0].variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 1,
          height: 1,
          fileName: `${job.id}-480w.webp`,
          mimeType: "image/webp",
        }),
      ])
    )

    const { filePath } = await service.getImageFile(images[0].id)
    await expect(access(filePath)).resolves.toBeUndefined()
    await expect(
      access(path.join(dataDir, "images", topic.id, `${job.id}-480w.webp`))
    ).resolves.toBeUndefined()
  })

  it("backfills optimization metadata for existing image records on list", async () => {
    const topic = await createTopic(service)
    const fileName = "legacy.png"
    await writePng(path.join(dataDir, "images", topic.id, fileName), {
      width: 1200,
      height: 900,
    })
    const legacyImage = {
      id: "legacy-image",
      topicId: topic.id,
      generationJobId: null,
      title: "Legacy image",
      rawPrompt: "Legacy prompt",
      enhancedPrompt: "Enhanced legacy prompt.",
      finalPrompt: "Enhanced legacy prompt.",
      aspectRatio: "4:3",
      enhancerMode: "storyboard",
      topicSnapshot: {
        id: topic.id,
        name: topic.name,
        instruction: topic.instruction,
        defaultAspectRatio: topic.defaultAspectRatio,
        basePromptDetails: topic.basePromptDetails,
        enhancerMode: topic.enhancerMode,
      },
      favorite: true,
      archivedAt: null,
      fileName,
      mimeType: "image/png",
      createdAt: "2026-05-04T10:00:00.000Z",
    }
    await store.writeImages([legacyImage])

    const images = await service.listImages(topic.id)

    expect(images[0]).toMatchObject({
      id: legacyImage.id,
      width: 1200,
      height: 900,
      placeholderColor: expect.stringMatching(/^#[0-9a-f]{6}$/u),
    })
    expect(images[0].variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 480,
          height: 360,
          fileName: "legacy-480w.webp",
          mimeType: "image/webp",
        }),
      ])
    )

    const persisted = await store.listImages()
    expect(persisted[0].variants).toHaveLength(4)
  })

  it("serves image variants with immutable webp cache headers", async () => {
    const topic = await createTopic(service)
    const fileName = "poster.png"
    await writePng(path.join(dataDir, "images", topic.id, fileName), {
      width: 1200,
      height: 900,
    })
    const image = await service.addImageRecord({
      topicId: topic.id,
      rawPrompt: "Swiss rail poster",
      enhancedPrompt: "Enhanced Swiss rail poster.",
      finalPrompt: "Enhanced Swiss rail poster.",
      aspectRatio: "4:3",
      enhancerMode: "storyboard",
      fileName,
      mimeType: "image/png",
    })

    await withServer(service, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/images/${image.id}/variants/480`
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("image/webp")
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable"
      )
      expect(response.headers.get("etag")).toEqual(expect.any(String))
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
    })
  })

  it("returns 400 for unsupported image variant widths", async () => {
    await withServer(service, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/images/missing-image/variants/640`
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        error: "Unsupported image variant width",
      })
    })
  })

  it("returns 404 for missing image variants", async () => {
    await withServer(service, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/images/missing-image/variants/480`
      )

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({
        error: "Image not found",
      })
    })
  })

  it("persists generated titles on generation jobs and image records", async () => {
    const generatedTitle = "Misty Tea Stall"
    const titledService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        ...createFakeCodexClient(),
        async generateTitle() {
          return generatedTitle
        },
      },
      autoRunJobs: false,
    })
    const topic = await createTopic(titledService)
    const job = await titledService.createGeneration(topic.id, {
      rawPrompt: "Morning tea stall in misty hills",
      aspectRatio: "4:3",
    })

    expect(job.title).toBe(generatedTitle)

    await titledService.runGenerationJob(job.id)
    const images = await titledService.listImages(topic.id)

    expect(images[0]).toMatchObject({
      generationJobId: job.id,
      title: generatedTitle,
    })
  })

  it("uses an explicit generation title before asking Codex for one", async () => {
    let generateTitleCalled = false
    const titledService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        ...createFakeCodexClient(),
        async generateTitle() {
          generateTitleCalled = true
          return "Wrong title"
        },
      },
      autoRunJobs: false,
    })
    const topic = await createTopic(titledService)
    const job = await titledService.createGeneration(topic.id, {
      rawPrompt: "A rainy hill station market at dusk",
      title: "Hill Station Market",
      aspectRatio: "4:3",
    })

    expect(job.title).toBe("Hill Station Market")
    expect(generateTitleCalled).toBe(false)
  })

  it("uses a clear prompt title prefix before asking Codex for one", async () => {
    let generateTitleCalled = false
    const titledService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        ...createFakeCodexClient(),
        async generateTitle() {
          generateTitleCalled = true
          return "Wrong title"
        },
      },
      autoRunJobs: false,
    })
    const topic = await createTopic(titledService)
    const job = await titledService.createGeneration(topic.id, {
      rawPrompt:
        "Image title: Misty Hills Tea Stall\nMorning tea stall in misty hills",
      aspectRatio: "4:3",
    })

    expect(job.title).toBe("Misty Hills Tea Stall")
    expect(generateTitleCalled).toBe(false)
  })

  it("falls back to a prompt title when generated title creation fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const resilientService = createFramebookService({
        store: createFramebookStore({ dataDir }),
        codexClient: {
          ...createFakeCodexClient(),
          async generateTitle() {
            throw new Error("title model unavailable")
          },
        },
        autoRunJobs: false,
      })
      const topic = await createTopic(resilientService)
      const job = await resilientService.createGeneration(topic.id, {
        rawPrompt: "A quiet mountain station platform",
        aspectRatio: "16:9",
      })

      expect(job.title).toBe("A quiet mountain station platform")
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("title generation failed")
      )

      const finishedJob = await resilientService.runGenerationJob(job.id)
      expect(finishedJob.status).toBe("succeeded")
    } finally {
      warn.mockRestore()
    }
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
      resolutionPreset: "2k",
      topic,
      outputPath,
    })

    expect(prompt).toContain("image creation skill/tool")
    expect(prompt).toContain("Do not create a placeholder")
    expect(prompt).toContain("Aspect ratio: 16:9")
    expect(prompt).toContain("Output resolution: 2K output resolution")
    expect(prompt).toContain("Morning tea stall")
    expect(prompt).toContain("Final cinematic tea stall prompt")
    expect(prompt).toContain(outputPath)
  })

  it("builds the codex app-server prompt enhancement contract", async () => {
    const topic = await createTopic(service)
    const prompt = buildPromptEnhancementPrompt({
      topic,
      rawPrompt: "A product photo of a ceramic mug",
    })

    expect(prompt).toContain("OpenAI GPT image generation models")
    expect(prompt).toContain("Return only the final enhanced prompt")
    expect(prompt).toContain("photorealistic")
    expect(prompt).toContain("no watermark")
    expect(prompt).toContain("A product photo of a ceramic mug")
    expect(prompt).not.toMatch(/intended use/iu)
    expect(prompt).toContain("not labeled segments")
    expect(prompt).not.toMatch(/aspect ratio|1:1|resolution|quality/iu)
  })

  it("uses separate codex app-server model and effort per operation", async () => {
    const topic = await createTopic(service)
    const sessions = []
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory(options) {
        sessions.push(options)
        return {
          async runTurn({ userText }) {
            const outputPath = userText.match(
              /Save the generated PNG image exactly at this absolute path:\n(.+?)\n-/u
            )?.[1]

            if (outputPath) {
              await mkdir(path.dirname(outputPath), { recursive: true })
              await writeFile(outputPath, "png")
            }

            return {
              responseText: userText.includes("short display title")
                ? "Tea Stall Morning"
                : "Enhanced tea stall prompt",
            }
          },
          stop() {},
        }
      },
    })

    await client.enhancePrompt({
      topic,
      rawPrompt: "Morning tea stall",
    })
    await client.generateTitle({
      topic,
      rawPrompt: "Morning tea stall",
      enhancedPrompt: "Enhanced morning tea stall",
    })
    await client.generateImage({
      prompt: "Enhanced morning tea stall",
      rawPrompt: "Morning tea stall",
      aspectRatio: "16:9",
      resolutionPreset: "2k",
      topic,
      outputDir: path.join(dataDir, "images"),
      fileName: "image.png",
    })

    expect(sessions.map(({ model, effort }) => ({ model, effort }))).toEqual([
      { model: "gpt-5.4-mini", effort: "medium" },
      { model: "gpt-5.4-mini", effort: "medium" },
      { model: "gpt-5.5", effort: "medium" },
    ])
  })

  it("builds the codex app-server title prompt contract", async () => {
    const topic = await createTopic(service)
    const prompt = buildImageTitlePrompt({
      topic,
      rawPrompt: "A product photo of a ceramic mug",
      enhancedPrompt: "Ceramic mug on a warm cafe table.",
    })

    expect(prompt).toContain("short display title")
    expect(prompt).toContain("at or below 60 characters")
    expect(prompt).toContain("A product photo of a ceramic mug")
    expect(prompt).toContain("Ceramic mug on a warm cafe table.")
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

async function writePng(filePath, { width, height }) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#336699",
    },
  })
    .png()
    .toFile(filePath)
}

async function withServer(service, callback) {
  setFramebookServiceForTesting(service)
  const server = createHttpServer()
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()

  try {
    return await callback(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
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
