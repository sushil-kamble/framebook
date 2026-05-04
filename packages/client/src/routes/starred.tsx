import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@app/framebook-app"

export const Route = createFileRoute("/starred")({
  component: StarredRoute,
})

function StarredRoute() {
  return <FramebookApp routeScreen="starred" />
}
