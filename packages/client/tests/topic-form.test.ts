import { describe, expect, it } from "vitest"
import {
  clearNewTopicDraft,
  defaultTopicDraft,
  loadNewTopicDraft,
  newTopicDraftStorageKey,
  normalizeTopicDraft,
  saveNewTopicDraft,
  validateTopicDraft,
} from "../src/app/lib/topic-form"

describe("topic form helpers", () => {
  it("requires only a topic name", () => {
    expect(
      validateTopicDraft({
        ...defaultTopicDraft,
        name: " ",
      })
    ).toEqual({
      name: "Name is required.",
    })
  })

  it("normalizes whitespace before sending a topic request", () => {
    expect(
      normalizeTopicDraft({
        ...defaultTopicDraft,
        name: "  Monsoon Trip Story  ",
        basePrompt: "  Rainy hill-station trip  ",
      })
    ).toMatchObject({
      name: "Monsoon Trip Story",
      basePrompt: "Rainy hill-station trip",
    })
  })

  it("round-trips the new topic draft through storage", () => {
    const storage = new Map<string, string>()
    const draft = {
      ...defaultTopicDraft,
      name: "Travel Posters",
      basePrompt: "Vintage mountain travel posters.",
      defaultAspectRatio: "3:4" as const,
    }

    saveNewTopicDraft(
      {
        setItem: (key, value) => storage.set(key, value),
      },
      draft
    )

    expect(storage.has(newTopicDraftStorageKey)).toBe(true)
    expect(
      loadNewTopicDraft({
        getItem: (key) => storage.get(key) ?? null,
      })
    ).toEqual(draft)

    clearNewTopicDraft({
      removeItem: (key) => storage.delete(key),
    })

    expect(storage.has(newTopicDraftStorageKey)).toBe(false)
  })

  it("falls back to the default new topic draft for invalid storage", () => {
    expect(
      loadNewTopicDraft({
        getItem: () => "{",
      })
    ).toEqual(defaultTopicDraft)
  })
})
