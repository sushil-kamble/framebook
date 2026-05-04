import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/topics/new")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
