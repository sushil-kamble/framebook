import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/gallery")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
