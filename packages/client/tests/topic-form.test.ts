import { describe, expect, it } from "vitest"
import {
  defaultTopicDraft,
  normalizeTopicDraft,
  validateTopicDraft,
} from "../src/app/lib/topic-form"

describe("topic form helpers", () => {
  it("requires a name and topic instruction", () => {
    expect(
      validateTopicDraft({
        ...defaultTopicDraft,
        name: " ",
        instruction: "",
      })
    ).toEqual({
      name: "Name is required.",
      instruction: "Topic instruction is required.",
    })
  })

  it("normalizes whitespace before sending a topic request", () => {
    expect(
      normalizeTopicDraft({
        ...defaultTopicDraft,
        name: "  Monsoon Trip Story  ",
        description: "  Rainy hill-station trip  ",
      })
    ).toMatchObject({
      name: "Monsoon Trip Story",
      description: "Rainy hill-station trip",
    })
  })
})
