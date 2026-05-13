export const creativeModeCatalog = [
  {
    id: "animal-infographic",
    name: "Animal Infographic",
    summary:
      "Labeled diagram of a creature with callout lines and clean typography.",
    defaultAspectRatio: "3:4",
    basePromptDetails:
      "Editorial infographic illustration of a single animal. Centered hero subject in flat illustration style on a soft cream background. Thin uniform line callouts radiating to short labels in a clean grotesque sans-serif. Limited palette of 4-6 muted colors. Subtle paper texture. Crisp anatomical accuracy.",
    creativeDirection:
      "Treat the image as a printable nature-magazine spread. Always preserve readable callout labels and small caption text exactly as requested. Avoid photographic rendering, dramatic lighting, or 3D shading. Keep negative space generous so labels never collide with the subject.",
  },
  {
    id: "makeup-guide",
    name: "Makeup Guide",
    summary: "Step-by-step beauty tutorial with annotated face zones.",
    defaultAspectRatio: "3:4",
    basePromptDetails:
      "Beauty tutorial illustration. Front-facing portrait or face chart with soft even studio lighting. Numbered steps and short text labels positioned around the face with thin connector lines. Warm pastel palette, clean editorial typography, semi-realistic illustration style.",
    creativeDirection:
      "Render skin smoothly without exaggerated retouching. Keep numbered steps legible and sequential. Preserve any product names or step text exactly. Avoid heavy shadows, busy backgrounds, or stock-photo aesthetics.",
  },
  {
    id: "cross-section",
    name: "Cross-section",
    summary: "Cutaway diagram revealing the inside of a structure or object.",
    defaultAspectRatio: "16:9",
    basePromptDetails:
      "Technical cross-section illustration with the front half cut away to expose interior layers, rooms, or mechanisms. Isometric or three-quarter view. Thin precise linework, light fill colors, subtle hatching for depth. Optional thin call-out lines with short labels.",
    creativeDirection:
      "Maintain consistent line weights and accurate proportions. Treat each visible interior compartment as its own clear region. Preserve any labels exactly. Avoid photoreal textures and dramatic lighting.",
  },
  {
    id: "research-visuals",
    name: "Research Visuals",
    summary: "Academic-style figure for papers, slides, or explainers.",
    defaultAspectRatio: "16:9",
    basePromptDetails:
      "Clean research figure with neutral white or off-white background. Geometric shapes, arrows, and small icons arranged to communicate a process or relationship. Limited two-to-three color palette. Sans-serif labels with high contrast. Subtle grid alignment.",
    creativeDirection:
      "Prioritize clarity over decoration. Preserve exact label wording, arrow directions, and node order. Avoid photoreal elements, gradients, or stylized illustration. The result should look credible inside a peer-reviewed paper or conference slide.",
  },
  {
    id: "scribble-studio",
    name: "Scribble Studio",
    summary: "Hand-drawn doodle explainer with playful annotations.",
    defaultAspectRatio: "4:3",
    basePromptDetails:
      "Hand-drawn marker illustration on white paper. Loose imperfect linework, occasional cross-hatching, scribbled emphasis marks. Optional handwritten labels and arrows. Two or three accent colors over black ink. Warm paper texture.",
    creativeDirection:
      "Embrace imperfection. Keep the look spontaneous and human. Preserve any handwritten phrases exactly. Avoid clean vector lines, gradients, or photoreal rendering.",
  },
  {
    id: "headshot",
    name: "Headshot",
    summary: "Professional studio portrait suitable for profile use.",
    defaultAspectRatio: "3:4",
    basePromptDetails:
      "Professional studio headshot. Sharp focus on the eyes, soft key light from upper-left, gentle fill, subtle rim light. Clean uncluttered background in a neutral tone. Natural skin texture, realistic color, neutral expression unless otherwise specified.",
    creativeDirection:
      "Treat the subject's identity as inviolable: preserve facial features, expression, and pose unless the user explicitly asks to change them. Avoid heavy retouching, stylization, costume changes, fantasy lighting, or unintended text and watermarks.",
  },
  {
    id: "blue-pin-poster",
    name: "Blue Pin Poster",
    summary:
      "Vintage travel-poster look with bold typography and limited palette.",
    defaultAspectRatio: "3:4",
    basePromptDetails:
      "Mid-century travel poster. Flat illustration with limited 4-5 color palette anchored on a deep ink-blue. Stylized landmarks or scenery with simplified shapes. Bold display title in hand-lettered serif and small location label below. Subtle paper grain.",
    creativeDirection:
      "Preserve any title and subtitle text exactly as written, with placement near the top or bottom edge. Avoid photoreal rendering, gradients, and cluttered detail. Composition should read clearly at small sizes.",
  },
  {
    id: "nighttime",
    name: "Nighttime",
    summary:
      "Atmospheric night scene with rich shadows and warm pools of light.",
    defaultAspectRatio: "16:9",
    basePromptDetails:
      "Cinematic nighttime scene. Deep navy and black shadow palette punctuated by warm tungsten or neon highlights. Wet reflective surfaces where appropriate, atmospheric haze, soft moonlight. Photoreal rendering with controlled grain.",
    creativeDirection:
      "Lead with mood and contrast. Keep highlights surgical and intentional. Avoid daytime lighting, flat exposure, or unintended text and signage. Preserve subject identity and pose.",
  },
  {
    id: "flash-comic",
    name: "Flash Comic",
    summary: "Single-page comic panel sequence with speech bubbles.",
    defaultAspectRatio: "4:3",
    basePromptDetails:
      "Comic page layout with 3-6 panels separated by clean white gutters. Bold ink linework, halftone shading, vivid limited color palette. Hand-lettered speech bubbles and caption boxes. Strong silhouettes, dynamic poses, clear panel-to-panel continuity.",
    creativeDirection:
      "Preserve all dialogue and caption text exactly as written, placed inside readable bubbles or boxes. Maintain consistent character design across panels. Avoid photoreal rendering and busy backgrounds that obscure the action.",
  },
  {
    id: "icon-design",
    name: "Icon Design",
    summary: "Single centered icon optimized for app and product surfaces.",
    defaultAspectRatio: "1:1",
    basePromptDetails:
      "App-style icon centered on a flat or subtly gradient background. Geometric shapes, balanced silhouette, soft inner shadow, minimal detail. Optional rounded square container. Crisp at small sizes. Cohesive 2-3 color palette.",
    creativeDirection:
      "Single subject, no scenery, no text inside the icon. Strong silhouette readable at 32px. Avoid photoreal rendering, ornate detail, or text labels unless the user explicitly requests a wordmark.",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    summary: "Painterly fantasy illustration with rich atmosphere and lore.",
    defaultAspectRatio: "16:9",
    basePromptDetails:
      "Painterly fantasy illustration in a digital-oil style. Dramatic atmospheric lighting, layered depth, rich color grading. Heroic composition, evocative environment, mythic creature or character anchored as the focal point. Subtle texture brushwork.",
    creativeDirection:
      "Lean into atmosphere and storytelling. Preserve any named characters, creatures, or props as described. Avoid flat vector aesthetics, modern UI elements, and unintended text. Composition should feel like a book-cover keyframe.",
  },
  {
    id: "newspaper",
    name: "Newspaper",
    summary:
      "Classic newsprint layout with headlines, columns, and engraved illustration.",
    defaultAspectRatio: "3:4",
    basePromptDetails:
      "Vintage newspaper page. Slightly aged off-white paper texture with halftone grain. Bold serif masthead at top, multi-column body of legible lorem-style text, one or two engraved-style illustrations with thin captions. Black ink on cream.",
    creativeDirection:
      "Preserve any headline, byline, or caption text exactly as written. Maintain column alignment and a believable type hierarchy. Avoid color photography, modern sans-serif body type, and digital UI cues.",
  },
]
