import { aspectRatios, generationVersionCounts } from "../config/framebook"

export { aspectRatios, generationVersionCounts }

export type AspectRatio = (typeof aspectRatios)[number]

export type GenerationVersionCount = (typeof generationVersionCounts)[number]

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed"

export interface ReferenceImage {
  id: string
  fileName: string
  originalName: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  sizeBytes: number
  width?: number
  height?: number
  createdAt: string
}

export interface Topic {
  id: string
  name: string
  defaultAspectRatio: AspectRatio
  basePrompt: string
  referenceImages: Array<ReferenceImage>
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TopicCounts {
  imageCount: number
  favoriteCount: number
  latestImageId: string | null
  latestImageCreatedAt: string | null
}

export interface TopicSummary extends Topic, TopicCounts {}

export interface TopicSnapshot extends Topic, TopicCounts {}

export interface ImageVariant {
  width: number
  height: number
  fileName: string
  mimeType: "image/webp"
}

export interface ImageRecord {
  id: string
  topicId: string
  generationJobId: string | null
  title: string
  rawPrompt: string
  enhancedPrompt: string
  finalPrompt: string
  imageGenerationPrompt: string
  researchContext?: string
  aspectRatio: AspectRatio
  topicSnapshot: TopicSnapshot
  favorite: boolean
  archivedAt: string | null
  fileName: string
  mimeType: string
  width?: number
  height?: number
  placeholderColor?: string
  variants?: Array<ImageVariant>
  referenceImages: Array<ReferenceImage>
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
  researchContext?: string
  aspectRatio: AspectRatio
  referenceImages: Array<ReferenceImage>
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
  defaultAspectRatio?: AspectRatio
  basePrompt?: string
}

export type UpdateTopicRequest = Partial<CreateTopicRequest>

export interface TopicListResponse {
  topics: Array<TopicSummary>
}

export interface TopicResponse {
  topic: TopicSummary
}

export interface TopicReferenceImagesResponse {
  topic: TopicSummary
  referenceImages: Array<ReferenceImage>
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

export type ResearchContextMode = "none" | "web"

export interface CreateGenerationRequest {
  rawPrompt: string
  enhancedPrompt?: string
  title?: string
  aspectRatio?: AspectRatio
  versionCount?: GenerationVersionCount
  contextMode?: ResearchContextMode
  topicReferenceImageIds?: Array<string>
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
