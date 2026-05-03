import { describe, expect, it, vi } from "vitest"
import { createFramebookApi } from "../src/shared/api/framebook"

describe("framebook api client", () => {
  it("creates topics through the expected endpoint", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({
        topic: {
          id: "topic-1",
          name: "Travel Poster Study",
        },
      })),
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
      }),
    )
  })

  it("surfaces api error messages", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ error: "Topic name is required" }, { status: 400 })),
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await expect(api.listTopics()).rejects.toMatchObject({
      message: "Topic name is required",
      status: 400,
    })
  })

  it("encodes topic ids for nested routes", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ images: [] })),
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.listImages("topic/with slash", true)

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics/topic%2Fwith%20slash/images?favorite=true",
      expect.any(Object),
    )
  })

  it("can request archived topics", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(Response.json({ topics: [] })),
    ) as unknown as typeof fetch
    const api = createFramebookApi(fetcher)

    await api.listTopics({ includeArchived: true })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/topics?includeArchived=true",
      expect.any(Object),
    )
  })
})
