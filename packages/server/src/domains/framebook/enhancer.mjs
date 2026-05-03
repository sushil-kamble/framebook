const aspectRatioGuidance = {
  '1:1': 'Square composition with a centered focal point and balanced edges.',
  '3:4': 'Portrait composition with vertical subject emphasis and clean top-to-bottom flow.',
  '4:3': 'Landscape composition with a clear subject, readable midground, and calm background.',
  '16:9': 'Wide cinematic composition with strong horizontal staging and room for context.',
}

const modeGuidance = {
  balanced:
    'Add practical visual specificity without making the prompt overly long.',
  storyboard:
    'Emphasize scene continuity, emotional beat, recurring details, and panel-like storytelling clarity.',
  'brand-product':
    'Emphasize polished product clarity, controlled background, crisp composition, and brand consistency.',
  'doodle-explainer':
    'Emphasize clean linework, readable objects, playful clarity, and minimal clutter.',
}

export function enhancePrompt({ topic, rawPrompt, aspectRatio }) {
  const cleanPrompt = normalizeWhitespace(rawPrompt)

  if (!cleanPrompt) {
    throw new Error('Raw prompt is required')
  }

  const ratio = aspectRatio || topic.defaultAspectRatio
  const topicInstruction = normalizeWhitespace(topic.instruction)
  const baseDetails = normalizeWhitespace(topic.basePromptDetails)
  const mode = topic.enhancerMode

  return [
    cleanPrompt,
    topicInstruction
      ? `Creative direction: ${trimTrailingPunctuation(topicInstruction)}.`
      : '',
    baseDetails
      ? `Persistent details to include when relevant: ${trimTrailingPunctuation(baseDetails)}.`
      : '',
    `Enhancement mode: ${modeGuidance[mode] ?? modeGuidance.balanced}`,
    `Composition: ${aspectRatioGuidance[ratio] ?? aspectRatioGuidance['16:9']}`,
    'Add concrete details for subject, action, setting, composition, lighting, color, material, mood, and focal point while preserving the original idea.',
    'If visible text is requested, specify exact wording and placement; otherwise avoid unintended text.',
    'Avoid vague filler and keep the final image prompt readable and editable.',
    `Aspect ratio: ${ratio}.`,
  ]
    .filter(Boolean)
    .join(' ')
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimTrailingPunctuation(value) {
  return value.replace(/[.?!]+$/u, '')
}
