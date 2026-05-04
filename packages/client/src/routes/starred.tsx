import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/starred")({
  component: EmptyRoute,
})

function EmptyRoute() {
  return null
}
