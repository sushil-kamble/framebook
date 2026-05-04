import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@app/framebook-app"

export const Route = createFileRoute("/gallery")({
  component: GalleryRoute,
})

function GalleryRoute() {
  return <FramebookApp routeScreen="gallery" />
}
