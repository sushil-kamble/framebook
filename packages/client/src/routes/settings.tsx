import { createFileRoute } from "@tanstack/react-router"
import { FramebookApp } from "@features/framebook/framebook-app"

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
})

function SettingsRoute() {
  return <FramebookApp routeScreen="settings" />
}
