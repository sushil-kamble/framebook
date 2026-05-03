import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@features/framebook/framebook-app"

export const Route = createFileRoute("/images/$imageId")({
  component: ImageDetailRoute,
})

function ImageDetailRoute() {
  const { imageId } = Route.useParams()

  return <FramebookApp routeScreen="image-detail" routeImageId={imageId} />
}
