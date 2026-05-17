import { useEffect, useState } from "react"
import { Loader2, Monitor, RotateCcw, Trash2 } from "lucide-react"
import { framebookApi, framebookApiUrl } from "@shared/api/framebook"
import { formatDate, imageFileUrl } from "../lib/utils"
import { AppBreadcrumb } from "./app-breadcrumb"
import { ConfirmationDialog } from "./confirmation-dialog"
import type {
  ImageRecord,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"

export function SettingsScreen({
  onDeleteImage,
  onUnarchiveImage,
  onUnarchiveTopic,
}: {
  onDeleteImage: (image: ImageRecord) => Promise<void>
  onUnarchiveImage: (image: ImageRecord) => Promise<void>
  onUnarchiveTopic: (topic: TopicSummary) => Promise<void>
}) {
  const [health, setHealth] = useState<{
    dataDir: string
    dbPath?: string
    codexAppServerConfigured: boolean
    codexAppServerCommand?: string
  } | null>(null)
  const [archivedTopics, setArchivedTopics] = useState<Array<TopicSummary>>([])
  const [archivedImages, setArchivedImages] = useState<Array<ImageRecord>>([])
  const [isLoadingArchivedTopics, setIsLoadingArchivedTopics] = useState(true)
  const [isLoadingArchivedImages, setIsLoadingArchivedImages] = useState(true)
  const [restoringTopicId, setRestoringTopicId] = useState<string | null>(null)
  const [restoringImageId, setRestoringImageId] = useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setIsLoadingArchivedTopics(true)
      setIsLoadingArchivedImages(true)
      try {
        const [healthResponse, topicsResponse, imagesResponse] =
          await Promise.all([
            fetch(framebookApiUrl("/api/health")).then((response) =>
              response.json()
            ),
            framebookApi.listTopics({ includeArchived: true }),
            framebookApi.listArchivedImages(),
          ])

        if (cancelled) return

        setHealth(healthResponse)
        setArchivedTopics(
          topicsResponse.topics.filter((topic: TopicSummary) =>
            Boolean(topic.archivedAt)
          )
        )
        setArchivedImages(imagesResponse.images)
      } catch {
        // Settings are informational, so the screen falls back instead of blocking.
        if (cancelled) return
        setHealth(null)
        setArchivedTopics([])
        setArchivedImages([])
      } finally {
        if (!cancelled) {
          setIsLoadingArchivedTopics(false)
          setIsLoadingArchivedImages(false)
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

  const restoreImage = async (image: ImageRecord) => {
    setRestoringImageId(image.id)
    try {
      await onUnarchiveImage(image)
      setArchivedImages((current) =>
        current.filter((candidate) => candidate.id !== image.id)
      )
    } finally {
      setRestoringImageId(null)
    }
  }

  const deleteImage = async (image: ImageRecord) => {
    setDeletingImageId(image.id)
    try {
      await onDeleteImage(image)
      setArchivedImages((current) =>
        current.filter((candidate) => candidate.id !== image.id)
      )
    } finally {
      setDeletingImageId(null)
    }
  }

  return (
    <div className="settings-stage relative min-h-svh overflow-hidden">
      <div className="settings-vignette pointer-events-none absolute inset-0" />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/92 px-4 py-4 shadow-sm backdrop-blur-sm md:px-6">
        <AppBreadcrumb items={[{ label: "Settings" }]} />
      </header>

      <div className="relative z-10 flex w-full justify-center px-4 pt-4 pb-6 md:px-6">
        <div className="settings-panel max-h-[calc(100svh-7rem)] w-full max-w-5xl overflow-y-auto rounded-3xl p-5 sm:p-6 lg:p-8">
          <div>
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

          <section className="mt-5 border-t border-border/40 pt-5">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm">
              <div>
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  Image preview shortcut
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Hover a previewable image thumbnail, then press{" "}
                  <kbd className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                    V
                  </kbd>{" "}
                  to open the preview.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-5 border-t border-border/40 pt-5">
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
                      {topic.basePrompt ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {topic.basePrompt}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-2.5 text-xs text-muted-foreground/60">
                        <span>{topic.imageCount} images</span>
                        <span>·</span>
                        <span>
                          Archived{" "}
                          <span className="font-medium text-foreground/80">
                            {topic.archivedAt
                              ? formatDate(topic.archivedAt)
                              : "Unknown"}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
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

          <section className="mt-5 border-t border-border/40 pt-5">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
              <div>
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  Archived images
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Archived images stay local and hidden from topic galleries.
                </p>
              </div>
              <span className="rounded-lg border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-semibold">
                {archivedImages.length}
              </span>
            </div>

            {isLoadingArchivedImages ? (
              <div
                className="mt-4 grid grid-cols-2 gap-3"
                aria-label="Loading archived images"
              >
                {["first", "second", "third", "fourth"].map((key) => (
                  <div
                    key={key}
                    className="aspect-4/3 overflow-hidden rounded-2xl border border-border/50 bg-muted"
                  >
                    <Skeleton className="size-full rounded-none" />
                  </div>
                ))}
              </div>
            ) : null}

            {!isLoadingArchivedImages && archivedImages.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border/50 p-5 text-sm text-muted-foreground/60">
                No archived images yet.
              </div>
            ) : null}

            {!isLoadingArchivedImages && archivedImages.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {archivedImages.map((image) => (
                  <article
                    key={image.id}
                    className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm"
                  >
                    <img
                      src={imageFileUrl(image.id)}
                      alt={image.title}
                      className="size-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-3 pt-14">
                      <div className="line-clamp-1 text-xs font-semibold text-white">
                        {image.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/55">
                        <span className="line-clamp-1">
                          {image.topicSnapshot.name}
                        </span>
                        <span>·</span>
                        <span>
                          {image.archivedAt
                            ? formatDate(image.archivedAt)
                            : "Unknown"}
                        </span>
                      </div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          restoringImageId === image.id ||
                          deletingImageId === image.id
                        }
                        onClick={() => void restoreImage(image)}
                      >
                        {restoringImageId === image.id ? (
                          <Loader2
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                        ) : (
                          <RotateCcw data-icon="inline-start" />
                        )}
                        Unarchive
                      </Button>
                      <ConfirmationDialog
                        title="Delete archived image?"
                        description={
                          <>
                            This will permanently delete "{image.title}" from
                            the database and remove its local image files.
                          </>
                        }
                        confirmLabel="Delete"
                        isPending={deletingImageId === image.id}
                        onConfirm={() => deleteImage(image)}
                        trigger={
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="border border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white focus-visible:border-destructive focus-visible:ring-destructive/30 dark:bg-destructive dark:hover:bg-destructive/90"
                            disabled={
                              restoringImageId === image.id ||
                              deletingImageId === image.id
                            }
                          >
                            {deletingImageId === image.id ? (
                              <Loader2
                                className="animate-spin"
                                data-icon="inline-start"
                              />
                            ) : (
                              <Trash2 data-icon="inline-start" />
                            )}
                            Delete
                          </Button>
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
