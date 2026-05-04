import { spawn } from "node:child_process"
import { EventEmitter } from "node:events"
import { promises as fs } from "node:fs"
import path from "node:path"
import readline from "node:readline"

const defaultImageModel = "gpt-5.5"
const defaultEnhancerModel = "gpt-5.4-mini"
const defaultTitleModel = "gpt-5.4-mini"
const defaultEffort = "medium"
const defaultTimeoutMs = 10 * 60 * 1000
const pngMimeType = "image/png"
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
)

export function createCodexClient({ env = process.env } = {}) {
  return new CodexAppServerImageClient({
    command: env.FRAMEBOOK_CODEX_BIN || "codex",
    cwd: env.FRAMEBOOK_CODEX_CWD || process.cwd(),
    env,
    imageModel: env.FRAMEBOOK_CODEX_IMAGE_MODEL || defaultImageModel,
    imageEffort: env.FRAMEBOOK_CODEX_IMAGE_EFFORT || defaultEffort,
    enhancerModel: env.FRAMEBOOK_CODEX_ENHANCER_MODEL || defaultEnhancerModel,
    enhancerEffort: env.FRAMEBOOK_CODEX_ENHANCER_EFFORT || defaultEffort,
    titleModel: env.FRAMEBOOK_CODEX_TITLE_MODEL || defaultTitleModel,
    titleEffort: env.FRAMEBOOK_CODEX_TITLE_EFFORT || defaultEffort,
    timeoutMs: readPositiveInteger(
      env.FRAMEBOOK_CODEX_TIMEOUT_MS,
      defaultTimeoutMs
    ),
  })
}

export function createFakeCodexClient() {
  return {
    name: "fake-codex-app-server",
    async generateImage({ outputDir, fileName }) {
      await fs.mkdir(outputDir, { recursive: true })
      const targetFileName = ensurePngFileName(fileName || `${Date.now()}.png`)
      const targetPath = path.join(outputDir, targetFileName)
      await fs.writeFile(targetPath, onePixelPng)

      return {
        filePath: targetPath,
        fileName: targetFileName,
        mimeType: pngMimeType,
      }
    },
  }
}

export class CodexAppServerImageClient {
  constructor(options = {}) {
    this.name = "codex-app-server"
    this.command = options.command || "codex"
    this.cwd = options.cwd || process.cwd()
    this.env = options.env || process.env
    this.imageModel = options.imageModel || options.model || defaultImageModel
    this.imageEffort = options.imageEffort || options.effort || defaultEffort
    this.enhancerModel = options.enhancerModel || defaultEnhancerModel
    this.enhancerEffort = options.enhancerEffort || defaultEffort
    this.titleModel = options.titleModel || defaultTitleModel
    this.titleEffort = options.titleEffort || defaultEffort
    this.timeoutMs = options.timeoutMs || defaultTimeoutMs
    this.sessionFactory =
      options.sessionFactory ||
      ((sessionOptions) => new CodexAppServerSession(sessionOptions))
  }

  async generateImage({
    prompt,
    rawPrompt,
    aspectRatio,
    resolutionPreset,
    topic,
    outputDir,
    fileName,
  }) {
    await fs.mkdir(outputDir, { recursive: true })
    const targetFileName = ensurePngFileName(fileName || `${Date.now()}.png`)
    const outputPath = path.join(outputDir, targetFileName)
    const appServer = this.createSession({
      command: this.command,
      cwd: this.cwd,
      env: this.env,
      model: this.imageModel,
      effort: this.imageEffort,
    })

    try {
      await appServer.runTurn({
        developerInstructions: framebookImageDeveloperInstructions(),
        userText: buildImageGenerationPrompt({
          prompt,
          rawPrompt,
          aspectRatio,
          resolutionPreset,
          topic,
          outputPath,
        }),
        timeoutMs: this.timeoutMs,
      })
      await waitForFile(outputPath, 10_000)

      return {
        filePath: outputPath,
        fileName: targetFileName,
        mimeType: pngMimeType,
      }
    } finally {
      appServer.stop()
    }
  }

  async enhancePrompt({ topic, rawPrompt }) {
    const appServer = this.createSession({
      command: this.command,
      cwd: this.cwd,
      env: this.env,
      model: this.enhancerModel,
      effort: this.enhancerEffort,
    })

    try {
      const result = await appServer.runTurn({
        developerInstructions: framebookPromptDeveloperInstructions(),
        userText: buildPromptEnhancementPrompt({
          topic,
          rawPrompt,
        }),
        timeoutMs: Math.min(this.timeoutMs, 120_000),
      })
      const enhancedPrompt = cleanCodexPromptResponse(result.responseText)

      if (!enhancedPrompt) {
        throw new Error("Codex App Server did not return an enhanced prompt")
      }

      return enhancedPrompt
    } finally {
      appServer.stop()
    }
  }

  async generateTitle({ topic, rawPrompt, enhancedPrompt }) {
    const appServer = this.createSession({
      command: this.command,
      cwd: this.cwd,
      env: this.env,
      model: this.titleModel,
      effort: this.titleEffort,
    })

    try {
      const result = await appServer.runTurn({
        developerInstructions: framebookTitleDeveloperInstructions(),
        userText: buildImageTitlePrompt({ topic, rawPrompt, enhancedPrompt }),
        timeoutMs: Math.min(this.timeoutMs, 60_000),
      })
      const title = cleanCodexPromptResponse(result.responseText)

      if (!title) {
        throw new Error("Codex App Server did not return an image title")
      }

      return title
    } finally {
      appServer.stop()
    }
  }

  createSession(options) {
    return this.sessionFactory(options)
  }
}

export class CodexAppServerSession extends EventEmitter {
  constructor({ command, cwd, env, model, effort }) {
    super()
    this.command = command
    this.cwd = cwd
    this.env = env
    this.model = model
    this.effort = effort
    this.nextId = 1
    this.pending = new Map()
    this.threadId = null
    this.activeTurnId = null
    this.proc = null
    this.reader = null
    this.stderr = ""
    this.responseText = ""
  }

  async runTurn({ developerInstructions, userText, timeoutMs }) {
    return withTimeout(
      new Promise((resolve, reject) => {
        const cleanup = () => {
          this.off("turnCompleted", onCompleted)
          this.off("sessionError", onError)
          this.off("exit", onExit)
        }
        const onCompleted = (event) => {
          cleanup()
          resolve({ ...event, responseText: this.responseText.trim() })
        }
        const onError = (event) => {
          cleanup()
          reject(new Error(event.message))
        }
        const onExit = ({ code, signal }) => {
          cleanup()
          reject(
            new Error(
              `Codex App Server exited before completing the turn (${code ?? signal})`
            )
          )
        }

        this.on("turnCompleted", onCompleted)
        this.on("sessionError", onError)
        this.on("exit", onExit)

        this.start()
        this.initialize()
          .then(() => this.startThread({ developerInstructions }))
          .then(() => this.sendUserText(userText))
          .catch(onError)
      }),
      timeoutMs,
      () =>
        `Codex App Server turn timed out after ${Math.round(timeoutMs / 1000)}s`
    )
  }

  start() {
    if (this.proc) {
      return
    }

    this.proc = spawn(this.command, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.cwd,
      env: this.env,
    })
    this.proc.on("error", (error) => {
      this.emitSessionError(
        `Codex App Server failed to start: ${error.message}`
      )
    })
    this.proc.on("exit", (code, signal) => {
      this.rejectPending(
        new Error(`Codex App Server exited (${code ?? signal})`)
      )
      this.emit("exit", { code, signal })
    })
    this.proc.stderr.on("data", (data) => {
      this.stderr += data.toString()
      process.stderr.write(`[framebook codex] ${data}`)
    })

    this.reader = readline.createInterface({ input: this.proc.stdout })
    this.reader.on("line", (line) => {
      if (!line.trim()) {
        return
      }

      let message
      try {
        message = JSON.parse(line)
      } catch {
        this.emitSessionError(`Codex App Server returned invalid JSON: ${line}`)
        return
      }

      this.handleMessage(message)
    })
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "framebook", title: "Framebook", version: "0.1.0" },
      capabilities: { experimentalApi: false, optOutNotificationMethods: [] },
    })
    this.notify("initialized", {})
  }

  async startThread({ developerInstructions }) {
    const result = await this.request("thread/start", {
      cwd: this.cwd,
      model: this.model,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      developerInstructions,
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    })
    this.threadId = result?.thread?.id ?? this.threadId
    return this.threadId
  }

  async sendUserText(text) {
    if (!this.threadId) {
      throw new Error("Codex App Server thread was not started")
    }

    return this.request("turn/start", {
      threadId: this.threadId,
      input: [{ type: "text", text, text_elements: [] }],
      model: this.model,
      effort: this.effort,
    })
  }

  request(method, params) {
    const id = this.nextId++

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      try {
        this.send({ jsonrpc: "2.0", method, id, params })
      } catch (error) {
        this.pending.delete(id)
        reject(error)
      }
    })
  }

  notify(method, params) {
    this.send({ jsonrpc: "2.0", method, params })
  }

  send(message) {
    if (!this.proc?.stdin?.writable) {
      throw new Error("Codex App Server stdin is not writable")
    }

    this.proc.stdin.write(`${JSON.stringify(message)}\n`)
  }

  handleMessage(message) {
    if (
      message.id !== undefined &&
      (message.result !== undefined || message.error !== undefined)
    ) {
      const pending = this.pending.get(message.id)
      if (!pending) {
        return
      }

      this.pending.delete(message.id)
      if (message.error) {
        pending.reject(
          new Error(message.error.message || JSON.stringify(message.error))
        )
      } else {
        pending.resolve(message.result)
      }
      return
    }

    if (message.id !== undefined && message.method) {
      this.handleServerRequest(message)
      return
    }

    if (message.method) {
      this.handleNotification(message)
    }
  }

  handleServerRequest(message) {
    let result = {}
    if (
      message.method === "item/commandExecution/requestApproval" ||
      message.method === "item/fileChange/requestApproval" ||
      message.method === "item/permissions/requestApproval" ||
      message.method === "applyPatchApproval" ||
      message.method === "execCommandApproval"
    ) {
      result = { decision: "approved" }
    }

    this.send({ jsonrpc: "2.0", id: message.id, result })
  }

  handleNotification(message) {
    switch (message.method) {
      case "thread/started":
        this.threadId = message.params?.thread?.id ?? this.threadId
        break
      case "turn/started":
        this.activeTurnId = message.params?.turn?.id ?? null
        this.responseText = ""
        break
      case "item/agentMessage/delta":
        this.responseText += message.params?.delta ?? ""
        break
      case "item/completed":
        if (
          message.params?.item?.type === "agent_message" &&
          !this.responseText
        ) {
          this.responseText += extractAgentMessageText(message.params.item)
        }
        break
      case "turn/completed":
        this.activeTurnId = null
        this.emit("turnCompleted", { turn: message.params?.turn })
        break
      case "error":
        this.emitSessionError(
          message.params?.message || "Codex App Server error"
        )
        break
      default:
        break
    }
  }

  emitSessionError(message) {
    const stderrHint = this.stderr.trim() ? `\n${this.stderr.trim()}` : ""
    this.emit("sessionError", { message: `${message}${stderrHint}` })
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error)
    }
    this.pending.clear()
  }

  stop() {
    try {
      this.reader?.close()
    } catch {
      // The reader may already be closed after process exit.
    }

    try {
      this.proc?.kill("SIGTERM")
    } catch {
      // The process may already be closed by the time cleanup runs.
    }
  }
}

export function buildImageGenerationPrompt({
  prompt,
  rawPrompt,
  aspectRatio,
  resolutionPreset,
  topic,
  outputPath,
}) {
  const topicDescription = topic.description
    ? `\nDescription: ${topic.description}`
    : ""
  const basePromptDetails = topic.basePromptDetails
    ? `\nReusable base prompt details: ${topic.basePromptDetails}`
    : ""
  const outputResolution = formatResolutionPreset(resolutionPreset)

  return `Generate exactly one Framebook image using the available image creation skill/tool.

Do not create a placeholder, SVG stand-in, HTML/CSS drawing, or text-only artifact. The output must be a real bitmap PNG image.

Topic: ${topic.name}${topicDescription}
Topic instruction: ${topic.instruction}${basePromptDetails}
Enhancer mode: ${topic.enhancerMode}
Aspect ratio: ${aspectRatio}
Output resolution: ${outputResolution}

Raw prompt:
${rawPrompt}

Final image prompt:
${prompt}

Output requirements:
- Create the parent directory if needed.
- Save the generated PNG image exactly at this absolute path:
${outputPath}
- Do not modify Framebook source files or metadata JSON.
- Reply with only the saved absolute path after the file exists.`
}

function formatResolutionPreset(value) {
  switch (value) {
    case "2k":
      return "2K output resolution"
    case "4k":
      return "4K output resolution"
    case "1k":
    default:
      return "1K output resolution"
  }
}

export function buildPromptEnhancementPrompt({ topic, rawPrompt }) {
  return `Rewrite the user's image prompt for OpenAI GPT image generation models. Return only the final enhanced prompt, with no markdown, no quotes, no explanation, and no preamble.

Use these GPT image prompting rules:
- Structure the prompt in a maintainable order: intended use, scene or background, subject, key details, composition, lighting, materials, style, and constraints.
- Preserve the user's original intent. Do not invent unrelated subjects.
- Be concrete about materials, shapes, textures, visual medium, framing, viewpoint, mood, and focal point.
- Include photorealistic or professional photography language only when it matches the user's intent.
- If text should appear in the image, put exact visible text in quotes and specify placement, style, contrast, and size. Otherwise explicitly avoid unintended text.
- Include constraints such as no watermark, no extra text, no logos or trademarks unless requested.
- For cinematic, low-light, rain, neon, UI mockup, infographic, diagram, product, or multi-panel requests, add the layout details needed for controllable output.
- Keep it editable and skimmable. Prefer one strong paragraph or short labeled segments, not a bloated essay.
- Output settings are handled later by Generate. Keep this rewrite limited to the visual intent and creative direction.

Topic context:
Name: ${topic.name}
Instruction: ${topic.instruction}
Base details: ${topic.basePromptDetails || "None"}
Enhancer mode: ${topic.enhancerMode}

User prompt:
${rawPrompt}`
}

export function buildImageTitlePrompt({ topic, rawPrompt, enhancedPrompt }) {
  return `Create a short display title for a generated Framebook image. Return only the title, with no markdown, no quotes, no explanation, and no preamble.

Rules:
- Use plain text only.
- Keep it at or below 60 characters.
- Summarize the image idea instead of repeating the whole prompt.
- Do not include output settings, style tags, file names, or camera jargon.

Topic context:
Name: ${topic.name}
Instruction: ${topic.instruction}

Raw prompt:
${rawPrompt}

Enhanced prompt:
${enhancedPrompt}`
}

function framebookImageDeveloperInstructions() {
  return `You are Framebook's Codex App Server image worker.

Use the image creation skill/tool when the user asks for image generation. Save the generated image to the exact absolute filesystem path requested by the user. Do not satisfy image requests with placeholders, SVGs, CSS drawings, or descriptive text.`
}

function framebookPromptDeveloperInstructions() {
  return `You are Framebook's prompt enhancement worker. Improve image prompts for GPT image generation models. Return only the final prompt text.`
}

function framebookTitleDeveloperInstructions() {
  return `You are Framebook's image title worker. Return one short, plain-text image title and nothing else.`
}

function cleanCodexPromptResponse(value) {
  return String(value ?? "")
    .trim()
    .replace(/^```(?:text)?/iu, "")
    .replace(/```$/u, "")
    .trim()
}

function extractAgentMessageText(item) {
  if (typeof item.text === "string") {
    return item.text
  }

  if (typeof item.content === "string") {
    return item.content
  }

  if (Array.isArray(item.content)) {
    return item.content
      .map((part) => {
        if (typeof part === "string") {
          return part
        }

        return part?.text ?? ""
      })
      .join("")
  }

  return ""
}

function ensurePngFileName(fileName) {
  const normalized = String(fileName)

  if (normalized.endsWith(".png")) {
    return normalized
  }

  if (/\.[^.]+$/u.test(normalized)) {
    return normalized.replace(/\.[^.]+$/u, ".png")
  }

  return `${normalized}.png`
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const stat = await fs.stat(filePath)
      if (stat.isFile() && stat.size > 0) {
        return
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error
      }
    }

    await delay(250)
  }

  throw new Error(
    `Codex App Server completed but did not create image file: ${filePath}`
  )
}

function withTimeout(promise, timeoutMs, messageFactory) {
  let timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(messageFactory()))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout)
  })
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
