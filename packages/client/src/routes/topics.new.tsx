import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@app/framebook-app"

export const Route = createFileRoute("/topics/new")({
  component: NewTopicRoute,
})

function NewTopicRoute() {
  return <FramebookApp routeScreen="topic-editor" />
}
