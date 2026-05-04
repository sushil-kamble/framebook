import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/settings")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
