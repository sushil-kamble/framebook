import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@app/framebook-app"

export const Route = createFileRoute("/topics/$topicId/edit")({
  component: EditTopicRoute,
})

function EditTopicRoute() {
  const { topicId } = Route.useParams()

  return <FramebookApp routeScreen="topic-editor" routeTopicId={topicId} />
}
