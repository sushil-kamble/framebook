import type {
  AspectRatio,
  CreateTopicRequest,
  Topic,
} from "@framebook/shared/contracts/framebook"

export interface TopicDraft {
  name: string
  defaultAspectRatio: AspectRatio
  basePrompt: string
}

export const defaultTopicDraft: TopicDraft = {
  name: "",
  defaultAspectRatio: "16:9",
  basePrompt: "",
}

export const newTopicDraftStorageKey = "framebook:new-topic-draft:v2"

export function draftFromTopic(topic: Topic): TopicDraft {
  return {
    name: topic.name,
    defaultAspectRatio: topic.defaultAspectRatio,
    basePrompt: topic.basePrompt,
  }
}

export function loadNewTopicDraft(
  storage: Pick<Storage, "getItem">
): TopicDraft {
  const stored = storage.getItem(newTopicDraftStorageKey)
  if (!stored) {
    return defaultTopicDraft
  }

  try {
    const parsed = JSON.parse(stored) as Partial<TopicDraft>

    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      defaultAspectRatio: isAspectRatio(parsed.defaultAspectRatio)
        ? parsed.defaultAspectRatio
        : defaultTopicDraft.defaultAspectRatio,
      basePrompt:
        typeof parsed.basePrompt === "string" ? parsed.basePrompt : "",
    }
  } catch {
    return defaultTopicDraft
  }
}

export function saveNewTopicDraft(
  storage: Pick<Storage, "setItem">,
  draft: TopicDraft
) {
  storage.setItem(newTopicDraftStorageKey, JSON.stringify(draft))
}

export function clearNewTopicDraft(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(newTopicDraftStorageKey)
}

export function normalizeTopicDraft(draft: TopicDraft): CreateTopicRequest {
  return {
    name: draft.name.trim(),
    defaultAspectRatio: draft.defaultAspectRatio,
    basePrompt: draft.basePrompt.trim(),
  }
}

export function validateTopicDraft(draft: TopicDraft) {
  const errors: Partial<Record<keyof TopicDraft, string>> = {}

  if (!draft.name.trim()) {
    errors.name = "Name is required."
  }

  return errors
}

function isAspectRatio(value: unknown): value is AspectRatio {
  return (
    value === "1:1" ||
    value === "4:3" ||
    value === "3:4" ||
    value === "16:9" ||
    value === "9:16"
  )
}
