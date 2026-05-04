import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/topics")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
