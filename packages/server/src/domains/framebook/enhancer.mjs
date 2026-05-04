const modeGuidance = {
  balanced:
    "Add practical visual specificity without making the prompt overly long.",
  storyboard:
    "Emphasize scene continuity, emotional beat, recurring details, and panel-like storytelling clarity.",
  "brand-product":
    "Emphasize product clarity, controlled background, composition, and brand consistency.",
  "doodle-explainer":
    "Emphasize clean linework, readable objects, playful clarity, and minimal clutter.",
}

export function enhancePrompt({ topic, rawPrompt }) {
  const cleanPrompt = normalizeWhitespace(rawPrompt)

  if (!cleanPrompt) {
    throw new Error("Raw prompt is required")
  }

  const topicInstruction = normalizeWhitespace(topic.instruction)
  const baseDetails = normalizeWhitespace(topic.basePromptDetails)
  const mode = topic.enhancerMode

  return [
    cleanPrompt,
    topicInstruction
      ? `Creative direction: ${trimTrailingPunctuation(topicInstruction)}.`
      : "",
    baseDetails
      ? `Persistent details to include when relevant: ${trimTrailingPunctuation(baseDetails)}.`
      : "",
    `Enhancement mode: ${modeGuidance[mode] ?? modeGuidance.balanced}`,
    "Add concrete details for subject, action, setting, composition, lighting, color, material, mood, and focal point while preserving the original idea.",
    "If visible text is requested, specify exact wording and placement; otherwise avoid unintended text.",
    "Avoid vague filler and keep the final image prompt readable and editable.",
    "Output settings are applied only when Generate runs.",
  ]
    .filter(Boolean)
    .join(" ")
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function trimTrailingPunctuation(value) {
  return value.replace(/[.?!]+$/u, "")
}
