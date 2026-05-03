import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router"
import { FramebookApp } from "@features/framebook/framebook-app"

export const Route = createFileRoute("/topics")({
  component: TopicsRoute,
})

function TopicsRoute() {
  const location = useLocation()

  if (location.pathname !== "/topics") {
    return <Outlet />
  }

  return <FramebookApp routeScreen="topics" />
}
