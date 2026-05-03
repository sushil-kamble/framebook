import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@features/framebook/framebook-app"

export const Route = createFileRoute("/gallery")({
  component: GalleryRoute,
})

function GalleryRoute() {
  return <FramebookApp routeScreen="gallery" />
}
