import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/topics/$topicId/images/$imageId")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
