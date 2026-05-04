import { ImageIcon, MoreVertical, Plus, Star } from "lucide-react"
import { framebookApiUrl } from "@shared/api/framebook"
import { cn } from "@shared/lib/utils"
import { formatDate } from "../lib/utils"
import { EmptyPanel } from "./empty-panel"
import type { TopicSummary } from "@framebook/shared/contracts/framebook"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"

export function TopicsScreen({
  topics,
  isLoading,
  onCreateTopic,
  onOpenTopic,
  onEditTopic,
}: {
  topics: Array<TopicSummary>
  isLoading: boolean
  onCreateTopic: () => void
  onOpenTopic: (topic: TopicSummary) => void
  onEditTopic: (topic: TopicSummary) => void
}) {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Topics
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your creative workspaces — prompts, settings, and images in one
            place.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={onCreateTopic}
        >
          <Plus className="size-3.5" />
          Create Topic
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading topics">
          <TopicCardSkeleton />
          <TopicCardSkeleton />
        </div>
      ) : null}

      {!isLoading && topics.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onOpen={() => onOpenTopic(topic)}
              onEdit={() => onEditTopic(topic)}
            />
          ))}
        </div>
      ) : null}

      {!isLoading && topics.length === 0 ? (
        <EmptyPanel
          title="No topics yet"
          body="Create a topic to organize your ideas, prompts, and generated images."
          actionLabel="Create Your First Topic"
          onAction={onCreateTopic}
        />
      ) : null}
    </div>
  )
}

function TopicCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <Skeleton className="aspect-5/1 w-full rounded-none" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2.5 h-3.5 w-5/6" />
            <Skeleton className="mt-1.5 h-3.5 w-4/6" />
          </div>
          <Skeleton className="size-4 rounded-md" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="size-4 rounded-md" />
        </div>
      </div>
    </div>
  )
}

function TopicCard({
  topic,
  onOpen,
  onEdit,
}: {
  topic: TopicSummary
  onOpen: () => void
  onEdit: () => void
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/25">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <button
        type="button"
        className="relative block w-full text-left"
        onClick={onOpen}
      >
        <div className="relative aspect-5/1 overflow-hidden bg-muted">
          {topic.latestImageId ? (
            <img
              src={framebookApiUrl(`/api/images/${topic.latestImageId}/file`)}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-muted to-accent">
              <div className="rounded-xl bg-background/20 p-2.5 backdrop-blur-sm">
                <ImageIcon className="size-5 text-muted-foreground/50" />
              </div>
            </div>
          )}
          <span className="absolute top-2.5 right-2.5 rounded-lg border border-white/10 bg-background/75 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur-sm">
            {topic.defaultAspectRatio}
          </span>
        </div>

        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-heading text-base font-semibold tracking-tight normal-case">
                {topic.name}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm tracking-normal text-muted-foreground normal-case">
                {topic.description || topic.instruction}
              </p>
            </div>
            <Star
              className={cn(
                "mt-0.5 size-4 shrink-0",
                topic.favoriteCount > 0
                  ? "fill-ring text-ring"
                  : "text-muted-foreground/40"
              )}
            />
          </div>
        </div>
      </button>
      <div className="relative flex items-center justify-between px-4 pb-3.5 text-xs text-muted-foreground">
        <span className="tracking-normal normal-case">
          {topic.imageCount} images
        </span>
        <span className="tracking-normal normal-case">
          {formatDate(topic.updatedAt)}
        </span>
        <button
          type="button"
          className="rounded-lg p-1.5 hover:bg-accent hover:text-accent-foreground"
          onClick={onEdit}
          aria-label={`Edit ${topic.name}`}
        >
          <MoreVertical className="size-3.5" />
        </button>
      </div>
    </article>
  )
}
