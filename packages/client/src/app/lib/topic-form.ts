import type {
  AspectRatio,
  CreateTopicRequest,
  Topic,
} from "@framebook/shared/contracts/framebook"

export interface TopicDraft {
  name: string
  description: string
  instruction: string
  defaultAspectRatio: AspectRatio
  basePromptDetails: string
  creativeModeId: string
}

export const defaultTopicDraft: TopicDraft = {
  name: "",
  description: "",
  instruction: "",
  defaultAspectRatio: "16:9",
  basePromptDetails: "",
  creativeModeId: "",
}

export function draftFromTopic(topic: Topic): TopicDraft {
  return {
    name: topic.name,
    description: topic.description,
    instruction: topic.instruction,
    defaultAspectRatio: topic.defaultAspectRatio,
    basePromptDetails: topic.basePromptDetails,
    creativeModeId: topic.creativeModeId,
  }
}

export function normalizeTopicDraft(draft: TopicDraft): CreateTopicRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    instruction: draft.instruction.trim(),
    defaultAspectRatio: draft.defaultAspectRatio,
    basePromptDetails: draft.basePromptDetails.trim(),
    creativeModeId: draft.creativeModeId || undefined,
  }
}

export function validateTopicDraft(draft: TopicDraft) {
  const errors: Partial<Record<keyof TopicDraft, string>> = {}

  if (!draft.name.trim()) {
    errors.name = "Name is required."
  }

  return errors
}
