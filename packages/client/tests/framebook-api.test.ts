import { describe, expect, it, vi } from "vitest"
import { createFramebookApi } from "../src/shared/api/framebook"

describe("framebook api client", () => {
  it("creates topics through the expected endpoint", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        Response.json({
          topic: {
            id: "topic-1",
            name: "Travel Poster Study",
          },
        })
      )
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.createTopic({
      name: "Travel Poster Study",
      defaultAspectRatio: "16:9",
      basePrompt: "Make vintage travel posters.",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Travel Poster Study"),
      })
    )
  })

  it("surfaces api error messages", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        Response.json({ error: "Topic name is required" }, { status: 400 })
      )
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await expect(api.listTopics()).rejects.toMatchObject({
      message: "Topic name is required",
      status: 400,
    })
  })

  it("encodes topic ids for nested routes", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ images: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.listImages("topic/with slash", true)

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic%2Fwith%20slash/images?favorite=true",
      expect.any(Object)
    )
  })

  it("can request archived topics", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ topics: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.listTopics({ includeArchived: true })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics?includeArchived=true",
      expect.any(Object)
    )
  })

  it("lists starred images through the global image endpoint", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ images: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.listStarredImages()

    expect(fetcher).toHaveBeenCalledWith("/api/images", expect.any(Object))
  })

  it("can request archived images through the global image endpoint", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ images: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.listArchivedImages()

    expect(fetcher).toHaveBeenCalledWith(
      "/api/images?archived=true",
      expect.any(Object)
    )
  })

  it("unarchives topics through the expected endpoint", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ topic: { id: "topic-1" } }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.unarchiveTopic("topic/with slash")

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic%2Fwith%20slash/unarchive",
      expect.objectContaining({
        method: "POST",
      })
    )
  })

  it("archives images through the image update endpoint", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ image: { id: "image-1" } }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.updateImage("image/with slash", { archived: true })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/images/image%2Fwith%20slash",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      })
    )
  })

  it("lists active generation jobs through the expected endpoint", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetcher: typeof fetch = (input, init) => {
      calls.push({ input, init })
      return Promise.resolve(Response.json({ jobs: [] }))
    }
    const api = createFramebookApi(fetcher)

    await api.listGenerationJobs("topic/with slash", { activeOnly: true })

    expect(calls).toHaveLength(1)
    expect(calls.at(0)?.input).toBe(
      "/api/topics/topic%2Fwith%20slash/generation-jobs?activeOnly=true"
    )
  })

  it("deletes an image", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ deleted: true, imageId: "image-1" }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.deleteImage("image/with slash")

    expect(fetcher).toHaveBeenCalledWith(
      "/api/images/image%2Fwith%20slash",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("can send an optional image title when creating a generation", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ job: { id: "job-1" } }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.createGeneration("topic/with slash", {
      rawPrompt: "A rainy hill station market at dusk",
      title: "Hill Station Market",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic%2Fwith%20slash/generations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          rawPrompt: "A rainy hill station market at dusk",
          title: "Hill Station Market",
        }),
      })
    )
  })

  it("can send the selected generation version count", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ job: { id: "job-1" }, jobs: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.createGeneration("topic-1", {
      rawPrompt: "A rainy hill station market at dusk",
      versionCount: 4,
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1/generations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          rawPrompt: "A rainy hill station market at dusk",
          versionCount: 4,
        }),
      })
    )
  })

  it("sends selected topic reference image ids in JSON generations", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ job: { id: "job-1" }, jobs: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.createGeneration("topic-1", {
      rawPrompt: "A rainy hill station market at dusk",
      topicReferenceImageIds: ["topic-ref-1"],
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1/generations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          rawPrompt: "A rainy hill station market at dusk",
          topicReferenceImageIds: ["topic-ref-1"],
        }),
      })
    )
  })

  it("sends an explicit empty topic reference image list", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ job: { id: "job-1" }, jobs: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.createGeneration("topic-1", {
      rawPrompt: "A rainy hill station market at dusk",
      topicReferenceImageIds: [],
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1/generations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          rawPrompt: "A rainy hill station market at dusk",
          topicReferenceImageIds: [],
        }),
      })
    )
  })

  it("sends prompt-only reference images as generation multipart data", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ job: { id: "job-1" }, jobs: [] }))
    )
    const api = createFramebookApi(fetcher)
    const referenceImage = new File(["png"], "prompt-reference.png", {
      type: "image/png",
    })

    await api.createGeneration(
      "topic-1",
      {
        rawPrompt: "A rainy hill station market at dusk",
        topicReferenceImageIds: ["topic-ref-1"],
      },
      [referenceImage]
    )

    const init = fetcher.mock.calls[0]?.[1] as RequestInit
    const formData = init.body as FormData

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1/generations",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(formData).toBeInstanceOf(FormData)
    expect(init.headers).not.toHaveProperty("content-type")
    expect(JSON.parse(String(formData.get("payload")))).toEqual({
      rawPrompt: "A rainy hill station market at dusk",
      topicReferenceImageIds: ["topic-ref-1"],
    })
    const uploadedReference = formData.get("referenceImages") as File
    expect(uploadedReference.name).toBe(referenceImage.name)
    expect(uploadedReference.type).toBe(referenceImage.type)
  })

  it("can send the research context mode when creating a generation", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ job: { id: "job-1" }, jobs: [] }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.createGeneration("topic-1", {
      rawPrompt: "A lesser-known trek poster",
      contextMode: "web",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1/generations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          rawPrompt: "A lesser-known trek poster",
          contextMode: "web",
        }),
      })
    )
  })

  it("can update a topic base prompt", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ topic: { id: "topic-1" } }))
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.updateTopic("topic-1", {
      name: "Plain Prompt",
      basePrompt: "Keep the same visual system.",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Plain Prompt",
          basePrompt: "Keep the same visual system.",
        }),
      })
    )
  })

  it("uploads topic reference images with multipart form data", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({ topic: { id: "topic-1" }, referenceImages: [] })
      )
    )
    const api = createFramebookApi(fetcher)
    const referenceImage = new File(["png"], "reference.png", {
      type: "image/png",
    })

    await api.addTopicReferenceImages("topic-1", [referenceImage])

    const init = fetcher.mock.calls[0]?.[1] as RequestInit

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic-1/reference-images",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.headers).not.toHaveProperty("content-type")
    const uploadedReference = (init.body as FormData).get(
      "referenceImages"
    ) as File
    expect(uploadedReference.name).toBe(referenceImage.name)
    expect(uploadedReference.type).toBe(referenceImage.type)
  })

  it("deletes topic reference images through the expected endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({ topic: { id: "topic-1" }, referenceImages: [] })
      )
    )
    const api = createFramebookApi(fetcher)

    await api.deleteTopicReferenceImage("topic/with slash", "ref/with slash")

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic%2Fwith%20slash/reference-images/ref%2Fwith%20slash",
      expect.objectContaining({
        method: "DELETE",
      })
    )
  })
})
