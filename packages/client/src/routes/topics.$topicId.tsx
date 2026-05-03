import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router"
import { FramebookApp } from "@features/framebook/framebook-app"

export const Route = createFileRoute("/topics/$topicId")({
  component: TopicRoute,
})

function TopicRoute() {
  const { topicId } = Route.useParams()
  const location = useLocation()

  if (location.pathname !== `/topics/${encodeURIComponent(topicId)}`) {
    return <Outlet />
  }

  return <FramebookApp routeScreen="topic" routeTopicId={topicId} />
}
