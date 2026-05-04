import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/topics/$topicId/edit")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
