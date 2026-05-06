import type {
  CreateGenerationRequest,
  CreateGenerationResponse,
  CreateTopicRequest,
  DeleteImageResponse,
  EnhancePromptRequest,
  EnhancePromptResponse,
  GenerationJobListResponse,
  GenerationJobResponse,
  ImageListResponse,
  ImageResponse,
  RevealImageResponse,
  TopicListResponse,
  TopicResponse,
  UpdateImageRequest,
  UpdateTopicRequest,
} from "@framebook/shared/contracts/framebook"

type Fetcher = typeof fetch

interface FramebookApiOptions {
  baseUrl?: string
  fetcher?: Fetcher
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export function createFramebookApi(
  options: Fetcher | FramebookApiOptions = {}
) {
  const fetcher =
    typeof options === "function" ? options : (options.fetcher ?? fetch)
  const baseUrl =
    typeof options === "function"
      ? ""
      : (options.baseUrl ?? defaultApiBaseUrl())

  async function request<TResponse>(input: string, init?: RequestInit) {
    const isFormData = isFormDataBody(init?.body)
    const response = await fetcher(framebookApiUrl(input, baseUrl), {
      ...init,
      headers: {
        ...(init?.body && !isFormData
          ? { "content-type": "application/json" }
          : {}),
        ...init?.headers,
      },
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      throw new ApiError(body?.error || "Request failed", response.status)
    }

    return (await response.json()) as TResponse
  }

  return {
    async listTopics(listOptions: { includeArchived?: boolean } = {}) {
      const query = listOptions.includeArchived ? "?includeArchived=true" : ""
      return request<TopicListResponse>(`/api/topics${query}`)
    },
    async createTopic(input: CreateTopicRequest) {
      return request<TopicResponse>("/api/topics", {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    async updateTopic(topicId: string, input: UpdateTopicRequest) {
      return request<TopicResponse>(
        `/api/topics/${encodeURIComponent(topicId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        }
      )
    },
    async archiveTopic(topicId: string) {
      return request<TopicResponse>(
        `/api/topics/${encodeURIComponent(topicId)}/archive`,
        {
          method: "POST",
        }
      )
    },
    async unarchiveTopic(topicId: string) {
      return request<TopicResponse>(
        `/api/topics/${encodeURIComponent(topicId)}/unarchive`,
        {
          method: "POST",
        }
      )
    },
    async listImages(topicId: string, favoriteOnly = false) {
      const query = favoriteOnly ? "?favorite=true" : ""
      return request<ImageListResponse>(
        `/api/topics/${encodeURIComponent(topicId)}/images${query}`
      )
    },
    async listStarredImages() {
      return request<ImageListResponse>("/api/images")
    },
    async listArchivedImages() {
      return request<ImageListResponse>("/api/images?archived=true")
    },
    async enhancePrompt(topicId: string, input: EnhancePromptRequest) {
      return request<EnhancePromptResponse>(
        `/api/topics/${encodeURIComponent(topicId)}/prompt/enhance`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      )
    },
    async createGeneration(
      topicId: string,
      input: CreateGenerationRequest,
      referenceImages: Array<File> = []
    ) {
      const body =
        referenceImages.length > 0
          ? generationFormData(input, referenceImages)
          : JSON.stringify(input)

      return request<CreateGenerationResponse>(
        `/api/topics/${encodeURIComponent(topicId)}/generations`,
        {
          method: "POST",
          body,
        }
      )
    },
    async listGenerationJobs(
      topicId: string,
      listOptions: { activeOnly?: boolean } = {}
    ) {
      const query = listOptions.activeOnly ? "?activeOnly=true" : ""
      return request<GenerationJobListResponse>(
        `/api/topics/${encodeURIComponent(topicId)}/generation-jobs${query}`
      )
    },
    async getGenerationJob(jobId: string) {
      return request<GenerationJobResponse>(
        `/api/generation-jobs/${encodeURIComponent(jobId)}`
      )
    },
    async updateImage(imageId: string, input: UpdateImageRequest) {
      return request<ImageResponse>(
        `/api/images/${encodeURIComponent(imageId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        }
      )
    },
    async getImage(imageId: string) {
      return request<ImageResponse>(
        `/api/images/${encodeURIComponent(imageId)}`
      )
    },
    async deleteImage(imageId: string) {
      return request<DeleteImageResponse>(
        `/api/images/${encodeURIComponent(imageId)}`,
        {
          method: "DELETE",
        }
      )
    },
    async revealImage(imageId: string) {
      return request<RevealImageResponse>(
        `/api/images/${encodeURIComponent(imageId)}/reveal`,
        {
          method: "POST",
        }
      )
    },
  }
}

function generationFormData(
  input: CreateGenerationRequest,
  referenceImages: Array<File>
) {
  const formData = new FormData()
  appendFormField(formData, "rawPrompt", input.rawPrompt)
  appendFormField(formData, "enhancedPrompt", input.enhancedPrompt)
  appendFormField(formData, "title", input.title)
  appendFormField(formData, "aspectRatio", input.aspectRatio)
  appendFormField(formData, "creativeModeId", input.creativeModeId)
  appendFormField(
    formData,
    "versionCount",
    input.versionCount === undefined ? undefined : String(input.versionCount)
  )

  for (const file of referenceImages) {
    formData.append("referenceImages", file, file.name)
  }

  return formData
}

function appendFormField(
  formData: FormData,
  name: string,
  value: string | undefined
) {
  if (value !== undefined && value !== "") {
    formData.append(name, value)
  }
}

function isFormDataBody(body: BodyInit | null | undefined) {
  return typeof FormData !== "undefined" && body instanceof FormData
}

export function framebookApiUrl(input: string, baseUrl = defaultApiBaseUrl()) {
  if (!baseUrl) {
    return input
  }

  return `${baseUrl.replace(/\/$/u, "")}${input}`
}

function defaultApiBaseUrl() {
  const env = import.meta.env
  return (
    env.VITE_FRAMEBOOK_API_BASE_URL ?? (env.DEV ? "http://127.0.0.1:8787" : "")
  )
}

export const framebookApi = createFramebookApi({
  baseUrl: defaultApiBaseUrl(),
})
