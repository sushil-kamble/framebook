export function enhancePrompt({ rawPrompt }) {
  const cleanPrompt = normalizeWhitespace(rawPrompt)

  if (!cleanPrompt) {
    throw new Error("Raw prompt is required")
  }

  return [
    cleanPrompt,
    "Preserve the user's subject, style, constraints, and requested visible text.",
    "Clarify composition, framing, lighting, color, materials, setting, focal point, and visual medium only where the original prompt leaves room.",
    "If visible text is requested, specify exact wording and placement; otherwise avoid unintended text.",
    "Do not add unrelated subjects, styles, settings, brands, logos, camera gear, or mood changes.",
    "Use clear image-generation wording such as draw, generate, or edit when it fits the original request.",
    "Keep the optimized prompt concise, readable, and editable.",
    "Output settings are applied only when Generate runs.",
  ].join(" ")
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}
