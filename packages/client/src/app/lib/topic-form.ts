import type {
  AspectRatio,
  CreateTopicRequest,
  EnhancerMode,
  Topic,
} from "@framebook/shared/contracts/framebook"

export interface TopicDraft {
  name: string
  description: string
  instruction: string
  defaultAspectRatio: AspectRatio
  basePromptDetails: string
  enhancerMode: EnhancerMode
}

export const defaultTopicDraft: TopicDraft = {
  name: "",
  description: "",
  instruction:
    "Create high-quality, visually compelling images that match this topic's style, mood, and intent. Stay consistent with composition, lighting, and typography where applicable.",
  defaultAspectRatio: "16:9",
  basePromptDetails:
    "Clean composition, natural lighting, strong focal point, polished visual style.",
  enhancerMode: "balanced",
}

export function draftFromTopic(topic: Topic): TopicDraft {
  return {
    name: topic.name,
    description: topic.description,
    instruction: topic.instruction,
    defaultAspectRatio: topic.defaultAspectRatio,
    basePromptDetails: topic.basePromptDetails,
    enhancerMode: topic.enhancerMode,
  }
}

export function normalizeTopicDraft(draft: TopicDraft): CreateTopicRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    instruction: draft.instruction.trim(),
    defaultAspectRatio: draft.defaultAspectRatio,
    basePromptDetails: draft.basePromptDetails.trim(),
    enhancerMode: draft.enhancerMode,
  }
}

export function validateTopicDraft(draft: TopicDraft) {
  const errors: Partial<Record<keyof TopicDraft, string>> = {}

  if (!draft.name.trim()) {
    errors.name = "Name is required."
  }

  if (!draft.instruction.trim()) {
    errors.instruction = "Topic instruction is required."
  }

  return errors
}
