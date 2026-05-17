export type Screen =
  | "topics"
  | "topic"
  | "gallery"
  | "starred"
  | "settings"
  | "topic-editor"
  | "image-detail"

export interface FramebookRouteState {
  routeScreen: Screen
  routeTopicId?: string
  routeImageId?: string
}

export interface FramebookAppProps {
  routeScreen?: Screen
  routeTopicId?: string
  routeImageId?: string
}

export interface PromptReferenceImageAttachment {
  id: string
  file: File
  previewUrl: string
}
