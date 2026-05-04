export type Screen =
  | "topics"
  | "topic"
  | "gallery"
  | "settings"
  | "topic-editor"
  | "image-detail"

export type RouteScreen = Screen

export interface FramebookAppProps {
  routeScreen?: RouteScreen
  routeTopicId?: string
  routeImageId?: string
}
