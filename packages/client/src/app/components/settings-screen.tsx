import { useEffect, useState } from "react"
import { Loader2, Monitor, RotateCcw } from "lucide-react"
import { framebookApi, framebookApiUrl } from "@shared/api/framebook"
import { formatDate, modeLabel } from "../lib/utils"
import type { TopicSummary } from "@framebook/shared/contracts/framebook"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"

export function SettingsScreen({
  onUnarchiveTopic,
}: {
  onUnarchiveTopic: (topic: TopicSummary) => Promise<void>
}) {
  const [health, setHealth] = useState<{
    dataDir: string
    dbPath?: string
    codexAppServerConfigured: boolean
    codexAppServerCommand?: string
  } | null>(null)
  const [archivedTopics, setArchivedTopics] = useState<Array<TopicSummary>>([])
  const [isLoadingArchivedTopics, setIsLoadingArchivedTopics] = useState(true)
  const [restoringTopicId, setRestoringTopicId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setIsLoadingArchivedTopics(true)
      try {
        const [healthResponse, topicsResponse] = await Promise.all([
          fetch(framebookApiUrl("/api/health")).then((response) =>
            response.json()
          ),
          framebookApi.listTopics({ includeArchived: true }),
        ])

        if (cancelled) return

        setHealth(healthResponse)
        setArchivedTopics(
          topicsResponse.topics.filter((topic: TopicSummary) =>
            Boolean(topic.archivedAt)
          )
        )
      } catch {
        // Settings are informational, so the screen falls back instead of blocking.
        if (cancelled) return
        setHealth(null)
        setArchivedTopics([])
      } finally {
        if (!cancelled) {
          setIsLoadingArchivedTopics(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const restoreTopic = async (topic: TopicSummary) => {
    setRestoringTopicId(topic.id)
    try {
      await onUnarchiveTopic(topic)
      setArchivedTopics((current) =>
        current.filter((candidate) => candidate.id !== topic.id)
      )
    } finally {
      setRestoringTopicId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        Settings
      </h1>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-border/40 pb-4">
          <div className="grid size-8 place-items-center rounded-xl framer-spotlight-orange text-white shadow-sm shadow-black/25">
            <Monitor className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Local workspace</div>
            <div className="text-xs text-muted-foreground">
              Topic metadata and generated files stay on this machine.
            </div>
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs tracking-wider text-muted-foreground/70 uppercase">
              Data directory
            </dt>
            <dd className="mt-1 text-sm font-medium break-all">
              {health?.dataDir ?? "Loading..."}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wider text-muted-foreground/70 uppercase">
              SQLite database
            </dt>
            <dd className="mt-1 text-sm font-medium break-all">
              {health?.dbPath ?? "Loading..."}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wider text-muted-foreground/70 uppercase">
              Codex App Server
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {health?.codexAppServerConfigured
                ? `Using ${health.codexAppServerCommand ?? "codex"} app-server`
                : "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wider text-muted-foreground/70 uppercase">
              Change workspace
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Set{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                FRAMEBOOK_DATA_DIR
              </code>{" "}
              before starting.
            </dd>
          </div>
        </dl>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div>
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Archived topics
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Archived topics stay local and hidden from the main view.
            </p>
          </div>
          <span className="rounded-lg border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-semibold">
            {archivedTopics.length}
          </span>
        </div>

        {isLoadingArchivedTopics ? (
          <div
            className="mt-4 space-y-2.5"
            aria-label="Loading archived topics"
          >
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : null}

        {!isLoadingArchivedTopics && archivedTopics.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border/50 p-5 text-sm text-muted-foreground/60">
            No archived topics yet.
          </div>
        ) : null}

        {!isLoadingArchivedTopics && archivedTopics.length > 0 ? (
          <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/60">
            {archivedTopics.map((topic) => (
              <div
                key={topic.id}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{topic.name}</div>
                  {topic.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {topic.description}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-2.5 text-xs text-muted-foreground/60">
                    <span>{topic.imageCount} images</span>
                    <span>·</span>
                    <span>{topic.defaultAspectRatio}</span>
                    <span>·</span>
                    <span>{modeLabel(topic.enhancerMode)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <div className="text-muted-foreground/60">Archived</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {topic.archivedAt
                        ? formatDate(topic.archivedAt)
                        : "Unknown"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={restoringTopicId === topic.id}
                    onClick={() => void restoreTopic(topic)}
                  >
                    {restoringTopicId === topic.id ? (
                      <Loader2
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <RotateCcw data-icon="inline-start" />
                    )}
                    Unarchive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
