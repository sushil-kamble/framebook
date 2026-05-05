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
  CodexAppServerSession,
  createCodexClient,
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
    let generateTitleCalled = false
    const titledService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: {
        ...createFakeCodexClient(),
        async generateTitle() {
          generateTitleCalled = true
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

    expect(job.title).toBe("Morning tea stall in misty hills")
    expect(generateTitleCalled).toBe(false)

    const finishedJob = await titledService.runGenerationJob(job.id)
    const images = await titledService.listImages(topic.id)

    expect(finishedJob.title).toBe(generatedTitle)
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

    await titledService.runGenerationJob(job.id)
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

    await titledService.runGenerationJob(job.id)
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
      expect(warn).not.toHaveBeenCalled()

      const finishedJob = await resilientService.runGenerationJob(job.id)
      expect(finishedJob.status).toBe("succeeded")
      expect(finishedJob.title).toBe("A quiet mountain station platform")
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("title generation failed")
      )
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

  it("stores reference images on generation jobs and generated image records", async () => {
    const referenceDataDir = path.join(dataDir, "reference-images")
    const referenceBuffer = await createPngBuffer({ width: 16, height: 10 })
    const capturedReferenceImages = []
    const fakeCodexClient = createFakeCodexClient()
    const referenceService = createFramebookService({
      store: createFramebookStore({ dataDir: referenceDataDir }),
      codexClient: {
        async generateImage(input) {
          capturedReferenceImages.push(...input.referenceImages)
          return fakeCodexClient.generateImage(input)
        },
      },
      autoRunJobs: false,
    })
    const topic = await createTopic(referenceService)

    const job = await referenceService.createGeneration(topic.id, {
      rawPrompt: "Change the shirt color but keep the face the same",
      aspectRatio: "4:3",
      referenceImages: [
        {
          originalName: "subject.png",
          mimeType: "image/png",
          sizeBytes: referenceBuffer.byteLength,
          buffer: referenceBuffer,
        },
      ],
    })

    expect(job.referenceImages).toHaveLength(1)
    expect(job.referenceImages[0]).toMatchObject({
      originalName: "subject.png",
      mimeType: "image/png",
      sizeBytes: referenceBuffer.byteLength,
      width: 16,
      height: 10,
    })
    expect(job.referenceImages[0].fileName).toMatch(
      /^references\/.+\/.+\.png$/u
    )
    expect(job.referenceImages[0]).not.toHaveProperty("filePath")
    await expect(
      access(
        path.join(
          referenceDataDir,
          "images",
          topic.id,
          job.referenceImages[0].fileName
        )
      )
    ).resolves.toBeUndefined()

    await referenceService.runGenerationJob(job.id)
    const images = await referenceService.listImages(topic.id)

    expect(images[0].referenceImages).toEqual(job.referenceImages)
    expect(capturedReferenceImages).toHaveLength(1)
    expect(capturedReferenceImages[0]).toMatchObject({
      originalName: "subject.png",
      filePath: path.join(
        referenceDataDir,
        "images",
        topic.id,
        job.referenceImages[0].fileName
      ),
    })
    await referenceService.close()
  })

  it("accepts multipart reference images through the generation endpoint", async () => {
    const topic = await createTopic(service)
    const formData = new FormData()
    formData.append("rawPrompt", "Make the subject wear a blue t-shirt")
    formData.append("aspectRatio", "4:3")
    formData.append(
      "referenceImages",
      new File(
        [await createPngBuffer({ width: 12, height: 12 })],
        "subject.png",
        {
          type: "image/png",
        }
      )
    )

    await withServer(service, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/topics/${topic.id}/generations`,
        {
          method: "POST",
          body: formData,
        }
      )

      expect(response.status).toBe(202)
      const body = await response.json()
      expect(body.job.referenceImages).toHaveLength(1)
      expect(body.job.referenceImages[0]).toMatchObject({
        originalName: "subject.png",
        mimeType: "image/png",
        width: 12,
        height: 12,
      })

      const finishedJob = await service.runGenerationJob(body.job.id)
      const referenceResponse = await fetch(
        `${baseUrl}/api/images/${finishedJob.imageId}/references/${body.job.referenceImages[0].id}/file`
      )

      expect(referenceResponse.status).toBe(200)
      expect(referenceResponse.headers.get("content-type")).toContain(
        "image/png"
      )
      expect(
        (await referenceResponse.arrayBuffer()).byteLength
      ).toBeGreaterThan(0)
    })
  })

  it("rejects invalid multipart reference image uploads", async () => {
    const topic = await createTopic(service)

    await withServer(service, async (baseUrl) => {
      const tooMany = new FormData()
      tooMany.append("rawPrompt", "Use these references")
      for (let index = 0; index < 6; index += 1) {
        tooMany.append(
          "referenceImages",
          new File(
            [await createPngBuffer({ width: 4, height: 4 })],
            `ref-${index}.png`,
            {
              type: "image/png",
            }
          )
        )
      }

      const tooManyResponse = await fetch(
        `${baseUrl}/api/topics/${topic.id}/generations`,
        { method: "POST", body: tooMany }
      )
      expect(tooManyResponse.status).toBe(400)
      await expect(tooManyResponse.json()).resolves.toMatchObject({
        error: "You can attach up to 5 images",
      })

      const unsupported = new FormData()
      unsupported.append("rawPrompt", "Use this reference")
      unsupported.append(
        "referenceImages",
        new File(["not an image"], "notes.txt", { type: "text/plain" })
      )

      const unsupportedResponse = await fetch(
        `${baseUrl}/api/topics/${topic.id}/generations`,
        { method: "POST", body: unsupported }
      )
      expect(unsupportedResponse.status).toBe(400)
      await expect(unsupportedResponse.json()).resolves.toMatchObject({
        error: "Reference image must be a PNG, JPEG, or WebP file",
      })
    })
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

  it("builds the codex app-server prompt with reference image paths", async () => {
    const topic = await createTopic(service)
    const referencePath = path.join(
      dataDir,
      "images",
      topic.id,
      "reference.png"
    )
    const prompt = buildImageGenerationPrompt({
      prompt: "Change the t-shirt color but preserve the face.",
      rawPrompt: "Change the t-shirt color",
      aspectRatio: "4:3",
      topic,
      referenceImages: [
        {
          originalName: "subject.png",
          filePath: referencePath,
        },
      ],
      outputPath: path.join(dataDir, "images", topic.id, "image.png"),
    })

    expect(prompt).toContain("Reference images:")
    expect(prompt).toContain(referencePath)
    expect(prompt).toContain("subject.png")
    expect(prompt).toContain("visual references")
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
        return createTestCodexSession()
      },
    })

    try {
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
        topic,
        outputDir: path.join(dataDir, "images"),
        fileName: "image.png",
      })

      expect(
        sessions.map(
          ({ model, effort, serviceTier, appServerArgs, logStderr }) => ({
            model,
            effort,
            serviceTier,
            appServerArgs,
            logStderr,
          })
        )
      ).toEqual([
        {
          model: "gpt-5.4-mini",
          effort: "low",
          serviceTier: "fast",
          appServerArgs: ["--disable", "plugins", "--disable", "apps"],
          logStderr: false,
        },
        {
          model: "gpt-5.4-mini",
          effort: "medium",
          serviceTier: undefined,
          appServerArgs: ["--disable", "plugins", "--disable", "apps"],
          logStderr: false,
        },
        {
          model: "gpt-5.5",
          effort: "medium",
          serviceTier: "fast",
          appServerArgs: ["--disable", "plugins", "--disable", "apps"],
          logStderr: false,
        },
      ])
    } finally {
      await client.close()
    }
  })

  it("isolates codex app-server sessions from user apps and plugin MCP servers", async () => {
    const client = createCodexClient({
      env: {
        ...process.env,
        FRAMEBOOK_CODEX_LOG_STDERR: "1",
      },
    })

    try {
      expect(client.appServerArgs).toEqual([
        "--disable",
        "plugins",
        "--disable",
        "apps",
      ])
      expect(client.logStderr).toBe(true)
    } finally {
      await client.close()
    }
  })

  it("passes service tier through rollback-compatible codex app-server thread and turn requests", async () => {
    const requests = []
    const session = new CodexAppServerSession({
      command: "codex",
      cwd: dataDir,
      env: process.env,
      model: "gpt-5.4-mini",
      effort: "low",
      serviceTier: "fast",
    })
    session.request = async (method, params) => {
      requests.push({ method, params })

      if (method === "thread/start") {
        return { thread: { id: "thread-1" } }
      }

      return {}
    }

    await session.startThread({
      developerInstructions: "Return enhanced prompts only.",
    })
    await session.sendUserText("Enhance this prompt")

    expect(requests[0].params).not.toHaveProperty("ephemeral")
    expect(requests[0].params).not.toHaveProperty("persistExtendedHistory")
    expect(requests).toEqual([
      {
        method: "thread/start",
        params: expect.objectContaining({
          developerInstructions: "Return enhanced prompts only.",
          serviceTier: "fast",
        }),
      },
      {
        method: "turn/start",
        params: expect.objectContaining({
          effort: "low",
          model: "gpt-5.4-mini",
          serviceTier: "fast",
          threadId: "thread-1",
        }),
      },
    ])
  })

  it("reuses one warm codex app-server thread for sequential prompt enhancement", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmEnhancerSessionFactory({
      responses: ["Enhanced first prompt", "Enhanced second prompt"],
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.enhancePrompt({ topic, rawPrompt: "first prompt" })
      ).resolves.toBe("Enhanced first prompt")
      await expect(
        client.enhancePrompt({ topic, rawPrompt: "second prompt" })
      ).resolves.toBe("Enhanced second prompt")

      expect(sessions).toHaveLength(1)
      expect(sessions[0].startCalls).toBe(1)
      expect(sessions[0].initializeCalls).toBe(1)
      expect(sessions[0].threadStartCalls).toHaveLength(1)
      expect(sessions[0].threadStartCalls[0]).not.toHaveProperty("ephemeral")
      expect(sessions[0].turnInputs).toHaveLength(2)
    } finally {
      await client.close()
    }
  })

  it("serializes concurrent prompt enhancement calls through the warm thread", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmEnhancerSessionFactory({
      responses: ["Enhanced first prompt", "Enhanced second prompt"],
      turnDelayMs: 20,
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        Promise.all([
          client.enhancePrompt({ topic, rawPrompt: "first prompt" }),
          client.enhancePrompt({ topic, rawPrompt: "second prompt" }),
        ])
      ).resolves.toEqual(["Enhanced first prompt", "Enhanced second prompt"])

      expect(sessions).toHaveLength(1)
      expect(sessions[0].maxActiveTurns).toBe(1)
      expect(sessions[0].turnInputs).toHaveLength(2)
    } finally {
      await client.close()
    }
  })

  it("discards a failed warm enhancer session and recreates it on the next prompt enhancement", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmEnhancerSessionFactory({
      responses: ["Unused failed prompt", "Recovered prompt"],
      failTurnIndexes: new Set([0]),
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.enhancePrompt({ topic, rawPrompt: "first prompt" })
      ).rejects.toThrow("enhancer turn 0 failed")
      expect(sessions).toHaveLength(1)
      expect(sessions[0].stopped).toBe(true)

      await expect(
        client.enhancePrompt({ topic, rawPrompt: "second prompt" })
      ).resolves.toBe("Recovered prompt")
      expect(sessions).toHaveLength(2)
      expect(sessions[1].turnInputs).toHaveLength(1)
    } finally {
      await client.close()
    }
  })

  it("rolls back one turn after each successful prompt enhancement", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmEnhancerSessionFactory({
      responses: ["Enhanced first prompt", "Enhanced second prompt"],
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await client.enhancePrompt({ topic, rawPrompt: "first prompt" })
      await client.enhancePrompt({ topic, rawPrompt: "second prompt" })

      expect(sessions[0].rollbackCalls).toEqual([
        { numTurns: 1 },
        { numTurns: 1 },
      ])
    } finally {
      await client.close()
    }
  })

  it("keeps a successful enhanced prompt but discards the warm session when rollback fails", async () => {
    const topic = await createTopic(service)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { sessionFactory, sessions } = createWarmEnhancerSessionFactory({
      responses: ["Enhanced first prompt"],
      failRollbackIndexes: new Set([0]),
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.enhancePrompt({ topic, rawPrompt: "first prompt" })
      ).resolves.toBe("Enhanced first prompt")

      expect(sessions[0].rollbackCalls).toEqual([{ numTurns: 1 }])
      expect(sessions[0].stopped).toBe(true)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("prompt enhancer rollback failed")
      )
    } finally {
      warn.mockRestore()
      await client.close()
    }
  })

  it("reuses one warm codex app-server thread for sequential image generation", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmImageSessionFactory()
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.generateImage({
          prompt: "First tea stall prompt",
          rawPrompt: "First tea stall",
          aspectRatio: "16:9",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "first.png",
        })
      ).resolves.toMatchObject({ fileName: "first.png", mimeType: "image/png" })
      await expect(
        client.generateImage({
          prompt: "Second tea stall prompt",
          rawPrompt: "Second tea stall",
          aspectRatio: "4:3",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "second.png",
        })
      ).resolves.toMatchObject({
        fileName: "second.png",
        mimeType: "image/png",
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0].startCalls).toBe(1)
      expect(sessions[0].initializeCalls).toBe(1)
      expect(sessions[0].threadStartCalls).toHaveLength(1)
      expect(sessions[0].turnInputs).toHaveLength(2)
      expect(sessions[0].rollbackCalls).toEqual([
        { numTurns: 1 },
        { numTurns: 1 },
      ])
    } finally {
      await client.close()
    }
  })

  it("serializes concurrent image generation calls through the warm thread", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmImageSessionFactory({
      turnDelayMs: 20,
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        Promise.all([
          client.generateImage({
            prompt: "First tea stall prompt",
            rawPrompt: "First tea stall",
            aspectRatio: "16:9",
            topic,
            outputDir: path.join(dataDir, "images"),
            fileName: "first.png",
          }),
          client.generateImage({
            prompt: "Second tea stall prompt",
            rawPrompt: "Second tea stall",
            aspectRatio: "4:3",
            topic,
            outputDir: path.join(dataDir, "images"),
            fileName: "second.png",
          }),
        ])
      ).resolves.toEqual([
        expect.objectContaining({ fileName: "first.png" }),
        expect.objectContaining({ fileName: "second.png" }),
      ])

      expect(sessions).toHaveLength(1)
      expect(sessions[0].maxActiveTurns).toBe(1)
      expect(sessions[0].turnInputs).toHaveLength(2)
    } finally {
      await client.close()
    }
  })

  it("discards a failed warm image session and recreates it on the next image generation", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmImageSessionFactory({
      failTurnIndexes: new Set([0]),
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.generateImage({
          prompt: "First tea stall prompt",
          rawPrompt: "First tea stall",
          aspectRatio: "16:9",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "first.png",
        })
      ).rejects.toThrow("image turn 0 failed")
      expect(sessions).toHaveLength(1)
      expect(sessions[0].stopped).toBe(true)

      await expect(
        client.generateImage({
          prompt: "Second tea stall prompt",
          rawPrompt: "Second tea stall",
          aspectRatio: "4:3",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "second.png",
        })
      ).resolves.toMatchObject({ fileName: "second.png" })
      expect(sessions).toHaveLength(2)
    } finally {
      await client.close()
    }
  })

  it("discards a warm image session when the completed turn does not create a file", async () => {
    const topic = await createTopic(service)
    const { sessionFactory, sessions } = createWarmImageSessionFactory({
      skipFileIndexes: new Set([0]),
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      imageFileTimeoutMs: 50,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.generateImage({
          prompt: "First tea stall prompt",
          rawPrompt: "First tea stall",
          aspectRatio: "16:9",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "first.png",
        })
      ).rejects.toThrow("did not create image file")
      expect(sessions).toHaveLength(1)
      expect(sessions[0].stopped).toBe(true)

      await expect(
        client.generateImage({
          prompt: "Second tea stall prompt",
          rawPrompt: "Second tea stall",
          aspectRatio: "4:3",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "second.png",
        })
      ).resolves.toMatchObject({ fileName: "second.png" })
      expect(sessions).toHaveLength(2)
    } finally {
      await client.close()
    }
  })

  it("keeps a successful image result but discards the warm session when image rollback fails", async () => {
    const topic = await createTopic(service)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { sessionFactory, sessions } = createWarmImageSessionFactory({
      failRollbackIndexes: new Set([0]),
    })
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory,
    })

    try {
      await expect(
        client.generateImage({
          prompt: "First tea stall prompt",
          rawPrompt: "First tea stall",
          aspectRatio: "16:9",
          topic,
          outputDir: path.join(dataDir, "images"),
          fileName: "first.png",
        })
      ).resolves.toMatchObject({ fileName: "first.png" })

      expect(sessions[0].rollbackCalls).toEqual([{ numTurns: 1 }])
      expect(sessions[0].stopped).toBe(true)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("image generator rollback failed")
      )
    } finally {
      warn.mockRestore()
      await client.close()
    }
  })

  it("closes warm image and enhancer sessions with the codex client", async () => {
    const sessions = []
    const client = new CodexAppServerImageClient({
      cwd: dataDir,
      timeoutMs: 1_000,
      sessionFactory() {
        const session = createTestCodexSession()
        sessions.push(session)
        return session
      },
    })

    await client.prewarmImageGenerator()
    await client.prewarmEnhancer()
    await client.close()

    expect(sessions).toHaveLength(2)
    expect(sessions.every((session) => session.stopped)).toBe(true)
  })

  it("closes the codex client with the Framebook service", async () => {
    const close = vi.fn()
    const cleanupService = createFramebookService({
      store: createFramebookStore({ dataDir }),
      codexClient: { close },
      autoRunJobs: false,
    })

    await cleanupService.close()

    expect(close).toHaveBeenCalledOnce()
  })

  it("prewarms codex prompt and image workers when the Framebook service is created", async () => {
    const prewarmImageGenerator = vi.fn().mockResolvedValue(undefined)
    const prewarmEnhancer = vi.fn().mockResolvedValue(undefined)
    const startupService = createFramebookService({
      store: createFramebookStore({ dataDir: path.join(dataDir, "startup") }),
      codexClient: {
        prewarmImageGenerator,
        prewarmEnhancer,
      },
      autoRunJobs: false,
    })

    await Promise.resolve()
    await startupService.close()

    expect(prewarmImageGenerator).toHaveBeenCalledOnce()
    expect(prewarmEnhancer).toHaveBeenCalledOnce()
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

function createTestCodexSession() {
  return {
    stopped: false,
    start() {},
    async initialize() {},
    async startThread() {
      return "test-thread"
    },
    async runTurnOnCurrentThread({ userText }) {
      const outputPath = imageOutputPathFromPrompt(userText)

      if (outputPath) {
        await mkdir(path.dirname(outputPath), { recursive: true })
        await writeFile(outputPath, "png")
      }

      return { responseText: "Enhanced tea stall prompt" }
    },
    async rollbackLastTurns() {},
    async runTurn({ userText }) {
      const outputPath = imageOutputPathFromPrompt(userText)

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
    stop() {
      this.stopped = true
    },
  }
}

function createWarmImageSessionFactory({
  failTurnIndexes = new Set(),
  failRollbackIndexes = new Set(),
  skipFileIndexes = new Set(),
  turnDelayMs = 0,
} = {}) {
  const sessions = []
  let nextSessionId = 1
  let nextTurnIndex = 0
  let nextRollbackIndex = 0

  return {
    sessions,
    sessionFactory(options) {
      const session = {
        id: nextSessionId,
        options,
        activeTurns: 0,
        initializeCalls: 0,
        maxActiveTurns: 0,
        rollbackCalls: [],
        startCalls: 0,
        stopped: false,
        threadStartCalls: [],
        turnInputs: [],
        start() {
          this.startCalls += 1
        },
        async initialize() {
          this.initializeCalls += 1
        },
        async startThread(input) {
          this.threadStartCalls.push(input)
          return `thread-${this.id}`
        },
        async runTurnOnCurrentThread({ userText }) {
          const turnIndex = nextTurnIndex
          nextTurnIndex += 1
          this.turnInputs.push(userText)
          this.activeTurns += 1
          this.maxActiveTurns = Math.max(this.maxActiveTurns, this.activeTurns)

          try {
            if (turnDelayMs > 0) {
              await sleep(turnDelayMs)
            }

            if (failTurnIndexes.has(turnIndex)) {
              throw new Error(`image turn ${turnIndex} failed`)
            }

            const outputPath = imageOutputPathFromPrompt(userText)
            if (outputPath && !skipFileIndexes.has(turnIndex)) {
              await mkdir(path.dirname(outputPath), { recursive: true })
              await writeFile(outputPath, "png")
            }

            return { responseText: outputPath || `image turn ${turnIndex}` }
          } finally {
            this.activeTurns -= 1
          }
        },
        async rollbackLastTurns(input) {
          const rollbackIndex = nextRollbackIndex
          nextRollbackIndex += 1
          this.rollbackCalls.push(input)

          if (failRollbackIndexes.has(rollbackIndex)) {
            throw new Error(`rollback ${rollbackIndex} failed`)
          }
        },
        stop() {
          this.stopped = true
        },
      }

      nextSessionId += 1
      sessions.push(session)
      return session
    },
  }
}

function imageOutputPathFromPrompt(userText) {
  return userText.match(
    /Save the generated PNG image exactly at this absolute path:\n(.+?)\n-/u
  )?.[1]
}

function createWarmEnhancerSessionFactory({
  responses = [],
  failTurnIndexes = new Set(),
  failRollbackIndexes = new Set(),
  turnDelayMs = 0,
} = {}) {
  const sessions = []
  let nextSessionId = 1
  let nextTurnIndex = 0
  let nextRollbackIndex = 0

  return {
    sessions,
    sessionFactory(options) {
      const session = {
        id: nextSessionId,
        options,
        activeTurns: 0,
        initializeCalls: 0,
        maxActiveTurns: 0,
        rollbackCalls: [],
        startCalls: 0,
        stopped: false,
        threadStartCalls: [],
        turnInputs: [],
        start() {
          this.startCalls += 1
        },
        async initialize() {
          this.initializeCalls += 1
        },
        async startThread(input) {
          this.threadStartCalls.push(input)
          return `thread-${this.id}`
        },
        async runTurnOnCurrentThread({ userText }) {
          const turnIndex = nextTurnIndex
          nextTurnIndex += 1
          this.turnInputs.push(userText)
          this.activeTurns += 1
          this.maxActiveTurns = Math.max(this.maxActiveTurns, this.activeTurns)

          try {
            if (turnDelayMs > 0) {
              await sleep(turnDelayMs)
            }

            if (failTurnIndexes.has(turnIndex)) {
              throw new Error(`enhancer turn ${turnIndex} failed`)
            }

            return {
              responseText:
                responses[turnIndex] ?? `Enhanced prompt ${turnIndex}`,
            }
          } finally {
            this.activeTurns -= 1
          }
        },
        async rollbackLastTurns(input) {
          const rollbackIndex = nextRollbackIndex
          nextRollbackIndex += 1
          this.rollbackCalls.push(input)

          if (failRollbackIndexes.has(rollbackIndex)) {
            throw new Error(`rollback ${rollbackIndex} failed`)
          }
        },
        stop() {
          this.stopped = true
        },
      }

      nextSessionId += 1
      sessions.push(session)
      return session
    },
  }
}

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

async function createPngBuffer({ width, height }) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#336699",
    },
  })
    .png()
    .toBuffer()
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
