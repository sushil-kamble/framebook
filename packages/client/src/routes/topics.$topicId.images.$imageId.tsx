import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@app/framebook-app"

export const Route = createFileRoute("/topics/$topicId/images/$imageId")({
  component: ImageDetailRoute,
})

function ImageDetailRoute() {
  const { imageId, topicId } = Route.useParams()

  return (
    <FramebookApp
      routeScreen="image-detail"
      routeTopicId={topicId}
      routeImageId={imageId}
    />
  )
}
