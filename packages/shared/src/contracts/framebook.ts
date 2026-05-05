export const aspectRatios = ["1:1", "3:4", "4:3", "16:9"] as const

export type AspectRatio = (typeof aspectRatios)[number]

export const generationVersionCounts = [1, 2, 4] as const

export type GenerationVersionCount = (typeof generationVersionCounts)[number]

export const enhancerModes = [
  "balanced",
  "storyboard",
  "brand-product",
  "doodle-explainer",
] as const

export type EnhancerMode = (typeof enhancerModes)[number]

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed"

export interface Topic {
  id: string
  name: string
  description: string
  instruction: string
  defaultAspectRatio: AspectRatio
  basePromptDetails: string
  enhancerMode: EnhancerMode
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TopicSummary extends Topic {
  imageCount: number
  favoriteCount: number
  latestImageId: string | null
  latestImageCreatedAt: string | null
}

export interface TopicSnapshot {
  id: string
  name: string
  instruction: string
  defaultAspectRatio: AspectRatio
  basePromptDetails: string
  enhancerMode: EnhancerMode
}

export interface ImageVariant {
  width: number
  height: number
  fileName: string
  mimeType: "image/webp"
}

export interface GenerationReferenceImage {
  id: string
  fileName: string
  originalName: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  sizeBytes: number
  width?: number
  height?: number
  createdAt: string
}

export interface ImageRecord {
  id: string
  topicId: string
  generationJobId: string | null
  title: string
  rawPrompt: string
  enhancedPrompt: string
  finalPrompt: string
  aspectRatio: AspectRatio
  enhancerMode: EnhancerMode
  topicSnapshot: TopicSnapshot
  favorite: boolean
  archivedAt: string | null
  fileName: string
  mimeType: string
  width?: number
  height?: number
  placeholderColor?: string
  variants?: Array<ImageVariant>
  referenceImages: Array<GenerationReferenceImage>
  createdAt: string
}

export interface GenerationJob {
  id: string
  topicId: string
  status: GenerationJobStatus
  title: string
  rawPrompt: string
  enhancedPrompt: string
  finalPrompt: string
  aspectRatio: AspectRatio
  referenceImages: Array<GenerationReferenceImage>
  imageId: string | null
  error: string | null
  batchId?: string
  versionIndex?: number
  versionCount?: GenerationVersionCount
  createdAt: string
  updatedAt: string
}

export interface CreateTopicRequest {
  name: string
  description?: string
  instruction: string
  defaultAspectRatio: AspectRatio
  basePromptDetails?: string
  enhancerMode: EnhancerMode
}

export type UpdateTopicRequest = Partial<CreateTopicRequest>

export interface TopicListResponse {
  topics: Array<TopicSummary>
}

export interface TopicResponse {
  topic: TopicSummary
}

export interface ImageListResponse {
  images: Array<ImageRecord>
}

export interface ImageResponse {
  image: ImageRecord
}

export interface DeleteImageResponse {
  deleted: boolean
  imageId: string
}

export interface EnhancePromptRequest {
  rawPrompt: string
  aspectRatio?: AspectRatio
}

export interface EnhancePromptResponse {
  rawPrompt: string
  enhancedPrompt: string
  aspectRatio: AspectRatio
}

export interface CreateGenerationRequest {
  rawPrompt: string
  enhancedPrompt?: string
  title?: string
  aspectRatio?: AspectRatio
  versionCount?: GenerationVersionCount
}

export interface CreateGenerationResponse {
  job: GenerationJob
  jobs: Array<GenerationJob>
}

export interface GenerationJobResponse {
  job: GenerationJob
}

export interface GenerationJobListResponse {
  jobs: Array<GenerationJob>
}

export interface UpdateImageRequest {
  favorite?: boolean
  archived?: boolean
}

export interface RevealImageResponse {
  path: string
  revealed: boolean
}
