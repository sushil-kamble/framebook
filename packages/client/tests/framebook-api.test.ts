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
      description: "",
      instruction: "Make vintage travel posters.",
      defaultAspectRatio: "16:9",
      basePromptDetails: "",
      enhancerMode: "balanced",
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
})
