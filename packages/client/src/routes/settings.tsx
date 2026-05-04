import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@app/framebook-app"

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
})

function SettingsRoute() {
  return <FramebookApp routeScreen="settings" />
}
