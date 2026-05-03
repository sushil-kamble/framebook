import { useNavigate } from "@tanstack/react-router"
import {
  Archive,
  Check,
  Download,
  Eye,
  FolderOpen,
  GalleryHorizontalEnd,
  Grid2X2,
  ImageIcon,
  Info,
  Loader2,
  Monitor,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Share2,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  defaultTopicDraft,
  draftFromTopic,
  normalizeTopicDraft,
  validateTopicDraft,
} from "@features/topics/topic-form"
import { framebookApi, framebookApiUrl } from "@shared/api/framebook"
import { cn } from "@shared/lib/utils"
import type {
  AspectRatio,
  EnhancerMode,
  GenerationJob,
  ImageRecord,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"
import type { TopicDraft } from "@features/topics/topic-form"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Separator } from "@/shared/ui/separator"
import { Skeleton } from "@/shared/ui/skeleton"
import { Textarea } from "@/shared/ui/textarea"

type Screen =
  | "topics"
  | "topic"
  | "gallery"
  | "settings"
  | "topic-editor"
  | "image-detail"
type RouteScreen = Screen

interface FramebookAppProps {
  routeScreen?: RouteScreen
  routeTopicId?: string
  routeImageId?: string
}

const aspectRatioOptions: Array<{
  value: AspectRatio
  label: string
  description: string
}> = [
  { value: "1:1", label: "1:1", description: "Square" },
  { value: "3:4", label: "3:4", description: "Portrait" },
  { value: "4:3", label: "4:3", description: "Landscape" },
  { value: "16:9", label: "16:9", description: "Wide" },
]

const enhancerModeOptions: Array<{
  value: EnhancerMode
  label: string
}> = [
  { value: "balanced", label: "Balanced" },
  { value: "storyboard", label: "Storyboard" },
  { value: "brand-product", label: "Brand / Product" },
  { value: "doodle-explainer", label: "Doodle / Explainer" },
]

const generationPollAttempts = 300
const generationPollIntervalMs = 2000

export function FramebookApp({
  routeScreen = "topics",
  routeTopicId,
  routeImageId,
}: FramebookAppProps = {}) {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Array<TopicSummary>>([])
  const [images, setImages] = useState<Array<ImageRecord>>([])
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>(routeScreen)
  const [topicEditor, setTopicEditor] = useState<{
    mode: "create" | "edit"
    topicId?: string
    draft: TopicDraft
  } | null>(null)
  const [rawPrompt, setRawPrompt] = useState("")
  const [enhancedPrompt, setEnhancedPrompt] = useState("")
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<AspectRatio>("16:9")
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(true)
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const [detailImage, setDetailImage] = useState<ImageRecord | null>(null)

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId) ?? null,
    [activeTopicId, topics],
  )
  const previewImage = useMemo(
    () =>
      images.find((image) => image.id === previewImageId) ??
      (detailImage?.id === previewImageId ? detailImage : null),
    [detailImage, images, previewImageId],
  )
  const activeDetailImage = useMemo(
    () =>
      images.find((image) => image.id === routeImageId) ??
      detailImage ??
      null,
    [detailImage, images, routeImageId],
  )

  const loadTopics = useCallback(async () => {
    setIsLoadingTopics(true)
    try {
      const response = await framebookApi.listTopics()
      setTopics(response.topics)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsLoadingTopics(false)
    }
  }, [])

  const loadImages = useCallback(async (topicId: string, onlyFavorites: boolean) => {
    setIsLoadingImages(true)
    try {
      const response = await framebookApi.listImages(topicId, onlyFavorites)
      setImages(response.images)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsLoadingImages(false)
    }
  }, [])

  useEffect(() => {
    void loadTopics()
  }, [loadTopics])

  useEffect(() => {
    setScreen(routeScreen)
    setError(null)

    if (routeTopicId) {
      setActiveTopicId(routeTopicId)
    }

    if (routeScreen !== "image-detail") {
      setDetailImage(null)
    }

    if (routeScreen === "topic-editor" && !routeTopicId) {
      setTopicEditor({ mode: "create", draft: defaultTopicDraft })
    }
  }, [routeScreen, routeTopicId])

  useEffect(() => {
    if (routeScreen !== "topic-editor" || !routeTopicId) {
      return
    }

    const topic = topics.find((candidate) => candidate.id === routeTopicId)
    if (!topic) {
      return
    }

    setTopicEditor({
      mode: "edit",
      topicId: topic.id,
      draft: draftFromTopic(topic),
    })
  }, [routeScreen, routeTopicId, topics])

  useEffect(() => {
    if (activeTopic) {
      setSelectedAspectRatio(activeTopic.defaultAspectRatio)
      void loadImages(activeTopic.id, favoriteOnly)
    }
  }, [activeTopic, favoriteOnly, loadImages])

  useEffect(() => {
    if (routeScreen !== "image-detail" || !routeImageId) {
      return
    }

    let cancelled = false
    const imageId = routeImageId

    async function loadImageDetail() {
      try {
        const response = await framebookApi.getImage(imageId)

        if (cancelled) {
          return
        }

        setDetailImage(response.image)
        setActiveTopicId(response.image.topicId)
        setSelectedAspectRatio(response.image.aspectRatio)
      } catch (requestError) {
        if (!cancelled) {
          setError(errorMessage(requestError))
        }
      }
    }

    void loadImageDetail()

    return () => {
      cancelled = true
    }
  }, [routeImageId, routeScreen])

  const navigateTo = (nextScreen: Screen, topicId?: string) => {
    const target = routeForScreen(nextScreen, topicId ?? activeTopicId)
    void navigate({ to: target } as Parameters<typeof navigate>[0])
  }

  const openImageDetail = (image: ImageRecord) => {
    setDetailImage(image)
    void navigate({
      to: `/images/${encodeURIComponent(image.id)}`,
    } as Parameters<typeof navigate>[0])
  }

  const openTopic = (topic: TopicSummary, nextScreen: Screen = "topic") => {
    setActiveTopicId(topic.id)
    setSelectedAspectRatio(topic.defaultAspectRatio)
    setScreen(nextScreen)
    setError(null)
    navigateTo(nextScreen, topic.id)
  }

  const startCreateTopic = () => {
    setTopicEditor({ mode: "create", draft: defaultTopicDraft })
    setScreen("topic-editor")
    setError(null)
    navigateTo("topic-editor")
  }

  const startEditTopic = (topic: TopicSummary) => {
    setTopicEditor({
      mode: "edit",
      topicId: topic.id,
      draft: draftFromTopic(topic),
    })
    setScreen("topic-editor")
    setError(null)
    navigateTo("topic-editor", topic.id)
  }

  const submitTopic = async (draft: TopicDraft) => {
    const normalized = normalizeTopicDraft(draft)
    const response =
      topicEditor?.mode === "edit" && topicEditor.topicId
        ? await framebookApi.updateTopic(topicEditor.topicId, normalized)
        : await framebookApi.createTopic(normalized)

    await loadTopics()
    setTopicEditor(null)
    openTopic(response.topic)
  }

  const archiveActiveTopic = async () => {
    if (!activeTopic) {
      return
    }

    await framebookApi.archiveTopic(activeTopic.id)
    setActiveTopicId(null)
    setImages([])
    setScreen("topics")
    navigateTo("topics")
    await loadTopics()
  }

  const enhanceCurrentPrompt = async () => {
    if (!activeTopic || !rawPrompt.trim()) {
      return
    }

    setIsEnhancing(true)
    setError(null)
    try {
      const result = await framebookApi.enhancePrompt(activeTopic.id, {
        rawPrompt,
        aspectRatio: selectedAspectRatio,
      })
      setRawPrompt(result.enhancedPrompt)
      setEnhancedPrompt(result.enhancedPrompt)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsEnhancing(false)
    }
  }

  const generateCurrentPrompt = async () => {
    if (!activeTopic || !rawPrompt.trim()) {
      return
    }

    setError(null)
    try {
      const response = await framebookApi.createGeneration(activeTopic.id, {
        rawPrompt,
        enhancedPrompt: enhancedPrompt.trim(),
        aspectRatio: selectedAspectRatio,
      })
      setJob(response.job)
      await pollGeneration(response.job.id)
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  const pollGeneration = async (jobId: string) => {
    for (let attempt = 0; attempt < generationPollAttempts; attempt += 1) {
      await delay(generationPollIntervalMs)
      const response = await framebookApi.getGenerationJob(jobId)
      setJob(response.job)

      if (response.job.status === "succeeded") {
        await Promise.all([
          loadTopics(),
          activeTopic ? loadImages(activeTopic.id, favoriteOnly) : Promise.resolve(),
        ])
        return
      }

      if (response.job.status === "failed") {
        setError(response.job.error || "Generation failed, but your prompt is safe.")
        return
      }
    }

    setError("Generation is still running. Refresh the topic in a moment.")
  }

  const reusePrompt = (image: ImageRecord) => {
    setActiveTopicId(image.topicId)
    setRawPrompt(image.rawPrompt)
    setEnhancedPrompt(image.enhancedPrompt)
    setSelectedAspectRatio(image.aspectRatio)
    setScreen("topic")
    navigateTo("topic", image.topicId)
  }

  const regenerateImage = async (image: ImageRecord) => {
    const topic = topics.find((candidate) => candidate.id === image.topicId)

    if (!topic) {
      return
    }

    setActiveTopicId(topic.id)
    setSelectedAspectRatio(image.aspectRatio)
    setRawPrompt(image.rawPrompt)
    setEnhancedPrompt(image.enhancedPrompt)
    setScreen("topic")
    setError(null)
    navigateTo("topic", topic.id)

    const response = await framebookApi.createGeneration(topic.id, {
      rawPrompt: image.rawPrompt,
      enhancedPrompt: image.enhancedPrompt,
      aspectRatio: image.aspectRatio,
    })
    setJob(response.job)
    await pollGeneration(response.job.id)
  }

  const toggleFavorite = async (image: ImageRecord) => {
    const response = await framebookApi.updateImage(image.id, {
      favorite: !image.favorite,
    })
    setImages((current) =>
      current.map((candidate) =>
        candidate.id === response.image.id ? response.image : candidate,
      ),
    )
    setDetailImage((current) =>
      current?.id === response.image.id ? response.image : current,
    )
    await loadTopics()
  }

  const shareImage = async (image: ImageRecord) => {
    const url = new URL(imageFileUrl(image.id), window.location.href).toString()
    const browserNavigator = navigator as unknown as {
      share?: (data: ShareData) => Promise<void>
      clipboard?: Clipboard
    }

    try {
      if (browserNavigator.share) {
        await browserNavigator.share({
          title: image.title,
          text: image.rawPrompt,
          url,
        })
        return
      }

      await browserNavigator.clipboard?.writeText(url)
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return
      }

      setError(errorMessage(shareError))
    }
  }

  const downloadImage = async (image: ImageRecord) => {
    try {
      const response = await fetch(imageFileUrl(image.id))
      if (!response.ok) {
        throw new Error("Unable to download image")
      }

      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = imageDownloadName(image)
      document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      setError(errorMessage(downloadError))
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh">
        <Sidebar
          screen={screen}
          onNavigate={navigateTo}
          onCreateTopic={startCreateTopic}
        />
        <section className="min-w-0 flex-1 px-5 py-5 md:px-8">
          {error ? (
            <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>{error}</span>
              <button
                type="button"
                className="rounded p-1 hover:bg-destructive/10"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {screen === "topics" ? (
            <TopicsScreen
              topics={topics}
              isLoading={isLoadingTopics}
              onCreateTopic={startCreateTopic}
              onOpenTopic={openTopic}
              onEditTopic={startEditTopic}
            />
          ) : null}

          {screen === "topic-editor" && topicEditor ? (
            <TopicEditorPage
              editor={topicEditor}
              onCancel={() => {
                setTopicEditor(null)
                navigateTo(activeTopic ? "topic" : "topics")
              }}
              onSubmit={submitTopic}
            />
          ) : null}

          {(screen === "topic" || screen === "gallery") && activeTopic ? (
            <TopicWorkspace
              topic={activeTopic}
              images={images}
              rawPrompt={rawPrompt}
              enhancedPrompt={enhancedPrompt}
              selectedAspectRatio={selectedAspectRatio}
              favoriteOnly={favoriteOnly}
              job={job}
              isEnhancing={isEnhancing}
              isLoadingImages={isLoadingImages}
              onBack={() => navigateTo("topics")}
              onEditTopic={() => startEditTopic(activeTopic)}
              onArchiveTopic={archiveActiveTopic}
              onRawPromptChange={setRawPrompt}
              onAspectRatioChange={setSelectedAspectRatio}
              onEnhancePrompt={enhanceCurrentPrompt}
              onGenerate={generateCurrentPrompt}
              onToggleFavorite={toggleFavorite}
              onRevealImage={(image) => framebookApi.revealImage(image.id)}
              onPreviewImage={(image) => {
                setPreviewImageId(image.id)
              }}
              onViewImageDetails={openImageDetail}
              onDownloadImage={downloadImage}
              onShareImage={shareImage}
              onFavoriteFilterChange={setFavoriteOnly}
            />
          ) : null}

          {(screen === "topic" || screen === "gallery") && !activeTopic ? (
            <EmptyPanel
              title="Choose a topic"
              body="Create or open a topic before generating images."
              actionLabel="Go to topics"
              onAction={() => navigateTo("topics")}
            />
          ) : null}

          {screen === "settings" ? <SettingsScreen /> : null}

          {screen === "image-detail" ? (
            <ImageDetailPage
              image={activeDetailImage}
              onBack={() => {
                const topicId = activeDetailImage?.topicId ?? activeTopicId
                navigateTo(topicId ? "topic" : "topics", topicId ?? undefined)
              }}
              onToggleFavorite={toggleFavorite}
              onReusePrompt={reusePrompt}
              onRegenerate={regenerateImage}
              onRevealImage={(image) => framebookApi.revealImage(image.id)}
              onPreviewImage={(image) => {
                setPreviewImageId(image.id)
              }}
              onDownloadImage={downloadImage}
              onShareImage={shareImage}
            />
          ) : null}
        </section>
      </div>

      <ImagePreviewDialog
        image={previewImage}
        onClose={() => setPreviewImageId(null)}
        onDownloadImage={downloadImage}
        onRevealImage={(image) => framebookApi.revealImage(image.id)}
        onShareImage={shareImage}
      />
    </main>
  )
}

function Sidebar({
  screen,
  onNavigate,
  onCreateTopic,
}: {
  screen: Screen
  onNavigate: (screen: Screen) => void
  onCreateTopic: () => void
}) {
  return (
    <aside className="hidden min-h-svh w-64 shrink-0 border-r bg-sidebar px-4 py-5 text-sidebar-foreground md:flex md:flex-col">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
          <Grid2X2 className="size-5" />
        </div>
        <div>
          <div className="text-base font-semibold">Framebook</div>
          <div className="text-xs text-muted-foreground">Image Studio</div>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        <NavButton
          active={screen === "topics" || screen === "topic-editor"}
          icon={<FolderOpen className="size-4" />}
          label="Topics"
          onClick={() => onNavigate("topics")}
        />
        <NavButton
          active={
            screen === "gallery" ||
            screen === "topic" ||
            screen === "image-detail"
          }
          icon={<GalleryHorizontalEnd className="size-4" />}
          label="Gallery"
          onClick={() => onNavigate("gallery")}
        />
        <NavButton
          active={screen === "settings"}
          icon={<Settings className="size-4" />}
          label="Settings"
          onClick={() => onNavigate("settings")}
        />
      </nav>

      <button
        type="button"
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        onClick={onCreateTopic}
      >
        <Plus className="size-4" />
        New Topic
      </button>

      <div className="mt-auto rounded-md border bg-card p-4 text-sm">
        <div className="mb-3 flex items-center gap-2 font-medium">
          <Monitor className="size-4" />
          Local-first
        </div>
        <div className="space-y-2 text-muted-foreground">
          <div className="flex gap-2">
            <Check className="mt-0.5 size-4 text-primary" />
            <span>Everything saved on this device</span>
          </div>
          <div className="flex gap-2">
            <Check className="mt-0.5 size-4 text-primary" />
            <span>Images stay in your local workspace</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
        active
          ? "border border-primary/35 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}

function TopicsScreen({
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
    <div className="mx-auto flex w-full min-w-0 max-w-180 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Topics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your creative workspaces. Topics keep prompts, settings, and images together.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          onClick={onCreateTopic}
        >
          <Plus className="size-4" />
          Create New Topic
        </button>
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
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <Skeleton className="mb-4 aspect-5/1 w-full rounded-md" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-3 h-4 w-5/6" />
        </div>
        <Skeleton className="size-5 rounded-full" />
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="size-5 rounded-full" />
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
    <article className="group rounded-md border bg-card p-4 shadow-sm transition hover:border-primary/35 hover:shadow-md">
      <button
        type="button"
        className="block w-full text-left"
        onClick={onOpen}
      >
        <div className="relative mb-4 aspect-5/1 overflow-hidden rounded-md border bg-muted">
          {topic.latestImageId ? (
            <img
              src={framebookApiUrl(`/api/images/${topic.latestImageId}/file`)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,var(--muted),white)]">
              <ImageIcon className="size-8 text-muted-foreground" />
            </div>
          )}
          <span className="absolute right-3 top-3 rounded-md border bg-background/90 px-2 py-1 text-xs font-medium">
            {topic.defaultAspectRatio}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold normal-case tracking-normal">{topic.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm normal-case tracking-normal text-muted-foreground">
              {topic.description || topic.instruction}
            </p>
          </div>
          <Star
            className={cn(
              "mt-1 size-5 shrink-0",
              topic.favoriteCount > 0
                ? "fill-primary text-primary"
                : "text-muted-foreground",
            )}
          />
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="normal-case tracking-normal">{topic.imageCount} images</span>
        <span className="normal-case tracking-normal">Updated {formatDate(topic.updatedAt)}</span>
        <button
          type="button"
          className="rounded p-1 hover:bg-accent hover:text-accent-foreground"
          onClick={onEdit}
          aria-label={`Edit ${topic.name}`}
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </article>
  )
}

function TopicWorkspace(props: {
  topic: TopicSummary
  images: Array<ImageRecord>
  rawPrompt: string
  enhancedPrompt: string
  selectedAspectRatio: AspectRatio
  favoriteOnly: boolean
  job: GenerationJob | null
  isEnhancing: boolean
  isLoadingImages: boolean
  onBack: () => void
  onEditTopic: () => void
  onArchiveTopic: () => void
  onRawPromptChange: (value: string) => void
  onAspectRatioChange: (value: AspectRatio) => void
  onEnhancePrompt: () => void
  onGenerate: () => void
  onToggleFavorite: (image: ImageRecord) => void
  onRevealImage: (image: ImageRecord) => Promise<unknown>
  onPreviewImage: (image: ImageRecord) => void
  onViewImageDetails: (image: ImageRecord) => void
  onDownloadImage: (image: ImageRecord) => Promise<void>
  onShareImage: (image: ImageRecord) => Promise<void>
  onFavoriteFilterChange: (value: boolean) => void
}) {
  const canGenerate = Boolean(props.rawPrompt.trim())
  const isGenerating =
    props.job?.status === "queued" || props.job?.status === "running"

  return (
    <div className="mx-auto flex h-[calc(100svh-2.5rem)] max-w-7xl flex-col gap-4">
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={props.onBack}>
              Topics
            </button>
            <span>/</span>
            <span>{props.topic.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{props.topic.name}</h1>
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Saved locally
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton label="Topic Settings" onClick={props.onEditTopic}>
            <Settings className="size-4" />
          </IconButton>
          <IconButton label="Archive Topic" onClick={props.onArchiveTopic}>
            <Archive className="size-4" />
          </IconButton>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col rounded-md border bg-card shadow-sm">
        <GalleryCanvas
          images={props.images}
          isLoading={props.isLoadingImages}
          favoriteOnly={props.favoriteOnly}
          onFavoriteFilterChange={props.onFavoriteFilterChange}
          onToggleFavorite={props.onToggleFavorite}
          onPreviewImage={props.onPreviewImage}
          onViewImageDetails={props.onViewImageDetails}
        />

        <Separator />

        <div className="flex flex-col gap-3 p-4">
          <GenerationStatus job={props.job} />
          <PromptComposer
            rawPrompt={props.rawPrompt}
            enhancedPrompt={props.enhancedPrompt}
            selectedAspectRatio={props.selectedAspectRatio}
            isEnhancing={props.isEnhancing}
            isGenerating={isGenerating}
            canGenerate={canGenerate}
            onRawPromptChange={props.onRawPromptChange}
            onAspectRatioChange={props.onAspectRatioChange}
            onEnhancePrompt={props.onEnhancePrompt}
            onGenerate={props.onGenerate}
          />
        </div>
      </section>
    </div>
  )
}

function PromptComposer(props: {
  rawPrompt: string
  enhancedPrompt: string
  selectedAspectRatio: AspectRatio
  isEnhancing: boolean
  isGenerating: boolean
  canGenerate: boolean
  onRawPromptChange: (value: string) => void
  onAspectRatioChange: (value: AspectRatio) => void
  onEnhancePrompt: () => void
  onGenerate: () => void
}) {
  return (
    <div className="rounded-3xl border bg-background/70 p-3 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <label className="text-sm font-semibold" htmlFor="raw-prompt">
            Prompt
          </label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {props.enhancedPrompt ? (
              <Badge variant="secondary">Enhanced</Badge>
            ) : null}
            <span>{props.rawPrompt.length} / 1000</span>
          </div>
        </div>
        <Textarea
          id="raw-prompt"
          value={props.rawPrompt}
          onChange={(event) => props.onRawPromptChange(event.target.value)}
          maxLength={1000}
          rows={3}
          className="min-h-24 resize-none bg-input/40"
          placeholder="Describe the image you want to create..."
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={props.selectedAspectRatio}
          onValueChange={(value) => props.onAspectRatioChange(value as AspectRatio)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Aspect ratio">
            <SelectValue placeholder="Aspect ratio" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {aspectRatioOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} {option.description}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={!props.canGenerate || props.isEnhancing || props.isGenerating}
            onClick={props.onEnhancePrompt}
          >
            {props.isEnhancing ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            Enhance
          </Button>
          <Button
            type="button"
            disabled={!props.canGenerate || props.isGenerating}
            onClick={props.onGenerate}
          >
            {props.isGenerating ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            Generate
          </Button>
        </div>
      </div>
    </div>
  )
}

function AspectRatioPicker({
  value,
  onChange,
}: {
  value: AspectRatio
  onChange: (value: AspectRatio) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold" htmlFor="topic-aspect-ratio">
        Aspect ratio
      </label>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as AspectRatio)}
      >
        <SelectTrigger
          id="topic-aspect-ratio"
          className="w-full"
          aria-label="Aspect ratio"
        >
          <SelectValue placeholder="Select aspect ratio" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {aspectRatioOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} {option.description}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function GenerationStatus({ job }: { job: GenerationJob | null }) {
  if (!job) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Generation status appears here after you create an image.
      </div>
    )
  }

  const running = job.status === "queued" || job.status === "running"

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {running ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : job.status === "succeeded" ? (
          <Check className="size-6 text-primary" />
        ) : (
          <X className="size-6 text-destructive" />
        )}
        <div>
          <div className="text-sm font-semibold">
            {running
              ? "Generating via local server..."
              : job.status === "succeeded"
                ? "Generation complete"
                : "Generation failed"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {job.status === "failed" ? job.error : `Job ${job.id.slice(0, 8)}`}
          </div>
        </div>
      </div>
    </div>
  )
}

function GalleryCanvas(props: {
  images: Array<ImageRecord>
  isLoading: boolean
  favoriteOnly: boolean
  onFavoriteFilterChange: (value: boolean) => void
  onToggleFavorite: (image: ImageRecord) => void
  onPreviewImage: (image: ImageRecord) => void
  onViewImageDetails: (image: ImageRecord) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Canvas</h2>
          <p className="text-sm text-muted-foreground">
            {props.images.length} images in this conversation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={props.favoriteOnly ? "default" : "outline"}
            size="sm"
            onClick={() => props.onFavoriteFilterChange(!props.favoriteOnly)}
          >
            <Star data-icon="inline-start" />
            Favorites
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {props.isLoading ? (
          <GallerySkeleton />
        ) : null}

        {!props.isLoading && props.images.length === 0 ? (
          <div className="grid min-h-full place-items-center rounded-md border border-dashed text-center">
            <div>
              <ImageIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
              <div className="font-medium">No images in this gallery yet</div>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Use the prompt box below to generate the first image for this topic.
              </p>
            </div>
          </div>
        ) : null}

        {!props.isLoading && props.images.length > 0 ? (
          <div className="grid auto-rows-[190px] grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {props.images.map((image) => (
              <article
                key={image.id}
                className="group relative overflow-hidden rounded-3xl border bg-muted shadow-sm transition hover:border-primary/50"
              >
                <button
                  type="button"
                  className="block size-full text-left"
                  onClick={() => {
                    props.onPreviewImage(image)
                  }}
                  aria-label={`Preview ${image.title}`}
                >
                  <img
                    src={imageFileUrl(image.id)}
                    alt={image.title}
                    className="size-full object-cover transition group-hover:scale-[1.03]"
                  />
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 to-transparent p-3 pt-12">
                  <div className="line-clamp-2 text-sm font-medium">
                    {image.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{image.aspectRatio}</span>
                    <span>{formatDate(image.createdAt)}</span>
                  </div>
                </div>

                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => props.onViewImageDetails(image)}
                    aria-label={`View details for ${image.title}`}
                    title="View details"
                  >
                    <Info />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => props.onToggleFavorite(image)}
                    aria-label={image.favorite ? "Remove favorite" : "Mark favorite"}
                    title={image.favorite ? "Remove favorite" : "Mark favorite"}
                  >
                    <Star
                      className={cn(
                        image.favorite ? "fill-primary text-primary" : "",
                      )}
                    />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function GallerySkeleton() {
  return (
    <div className="grid auto-rows-[190px] grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="Loading gallery">
      {["first", "second", "third", "fourth", "fifth", "sixth"].map((key) => (
        <div
          key={key}
          className="overflow-hidden rounded-3xl border bg-muted"
        >
          <Skeleton className="size-full rounded-none" />
        </div>
      ))}
    </div>
  )
}

function ImagePreviewDialog(props: {
  image: ImageRecord | null
  onClose: () => void
  onDownloadImage: (image: ImageRecord) => Promise<void>
  onRevealImage: (image: ImageRecord) => Promise<unknown>
  onShareImage: (image: ImageRecord) => Promise<void>
}) {
  const image = props.image

  if (!image) {
    return null
  }

  return (
    <Dialog open={Boolean(image)} onOpenChange={(open) => {
      if (!open) {
        props.onClose()
      }
    }}>
      <DialogContent className="max-h-[92vh] max-w-[min(1100px,calc(100vw-2rem))] gap-4 overflow-hidden p-4" showCloseButton>
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{image.title}</DialogTitle>
          <DialogDescription>
            {image.aspectRatio} · {formatDate(image.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 place-items-center rounded-3xl bg-background p-3">
          <img
            src={imageFileUrl(image.id)}
            alt={image.title}
            className="max-h-[74vh] max-w-full rounded-md object-contain"
          />
        </div>
        <DialogFooter className="sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Click outside or press Escape to close.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void props.onDownloadImage(image)}>
              <Download data-icon="inline-start" />
              Download
            </Button>
            <Button variant="outline" onClick={() => void props.onRevealImage(image)}>
              <FolderOpen data-icon="inline-start" />
              Finder
            </Button>
            <Button variant="outline" onClick={() => void props.onShareImage(image)}>
              <Share2 data-icon="inline-start" />
              Share
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImageDetailPage(props: {
  image: ImageRecord | null
  onBack: () => void
  onToggleFavorite: (image: ImageRecord) => void
  onReusePrompt: (image: ImageRecord) => void
  onRegenerate: (image: ImageRecord) => void
  onRevealImage: (image: ImageRecord) => Promise<unknown>
  onPreviewImage: (image: ImageRecord) => void
  onDownloadImage: (image: ImageRecord) => Promise<void>
  onShareImage: (image: ImageRecord) => Promise<void>
}) {
  const image = props.image

  if (!image) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-105 w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            className="mb-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={props.onBack}
          >
            Gallery / {image.topicSnapshot.name}
          </button>
          <h1 className="line-clamp-2 text-3xl font-semibold">{image.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{image.aspectRatio}</Badge>
            <Badge variant={image.favorite ? "default" : "outline"}>
              {image.favorite ? "Favorite" : "Not favorite"}
            </Badge>
            <Badge variant="outline">{modeLabel(image.enhancerMode)}</Badge>
            <Badge variant="outline">{formatDate(image.createdAt)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => props.onReusePrompt(image)}>
            <Sparkles data-icon="inline-start" />
            Reuse
          </Button>
          <Button variant="outline" onClick={() => props.onRegenerate(image)}>
            <RotateCcw data-icon="inline-start" />
            Regenerate
          </Button>
          <Button variant="outline" onClick={() => props.onToggleFavorite(image)}>
            <Star
              data-icon="inline-start"
              className={cn(image.favorite ? "fill-primary text-primary" : "")}
            />
            Favorite
          </Button>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="overflow-hidden rounded-3xl border bg-muted shadow-sm"
            onClick={() => props.onPreviewImage(image)}
          >
            <img
              src={imageFileUrl(image.id)}
              alt={image.title}
              className="max-h-160 w-full object-contain"
            />
          </button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => props.onPreviewImage(image)}>
              <Eye data-icon="inline-start" />
              Preview
            </Button>
            <Button variant="outline" onClick={() => void props.onDownloadImage(image)}>
              <Download data-icon="inline-start" />
              Download
            </Button>
            <Button variant="outline" onClick={() => void props.onRevealImage(image)}>
              <FolderOpen data-icon="inline-start" />
              Open in Finder
            </Button>
            <Button variant="outline" onClick={() => void props.onShareImage(image)}>
              <Share2 data-icon="inline-start" />
              Share
            </Button>
          </div>
        </div>

        <aside className="flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-sm">
          <PromptBlock label="Raw prompt" value={image.rawPrompt} />
          <PromptBlock label="Enhanced prompt" value={image.enhancedPrompt} />
          <PromptBlock label="Final prompt" value={image.finalPrompt} />
          <Separator />
          <PromptBlock
            label="Topic instruction snapshot"
            value={image.topicSnapshot.instruction}
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <MetaItem label="Topic" value={image.topicSnapshot.name} />
            <MetaItem label="Aspect ratio" value={image.aspectRatio} />
            <MetaItem label="Created" value={formatDate(image.createdAt)} />
            <MetaItem label="Mode" value={modeLabel(image.enhancerMode)} />
            <MetaItem label="File" value={image.fileName} />
            <MetaItem label="MIME" value={image.mimeType} />
          </dl>
        </aside>
      </section>
    </div>
  )
}

function PromptBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">{value}</p>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  )
}

function TopicEditorPage({
  editor,
  onCancel,
  onSubmit,
}: {
  editor: { mode: "create" | "edit"; draft: TopicDraft }
  onCancel: () => void
  onSubmit: (draft: TopicDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState(editor.draft)
  const [errors, setErrors] = useState<
    Partial<Record<keyof TopicDraft, string>>
  >({})
  const [isSaving, setIsSaving] = useState(false)

  const updateDraft = <TKey extends keyof TopicDraft>(
    key: TKey,
    value: TopicDraft[TKey],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const updateCreativeDirection = (value: string) => {
    setDraft((current) => ({
      ...current,
      description: value,
      instruction: value,
    }))
  }

  const submit = async () => {
    const nextErrors = validateTopicDraft(draft)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSaving(true)
    try {
      await onSubmit(draft)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-180 flex-col gap-6">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Topics / {editor.mode === "create" ? "New Topic" : "Edit Topic"}
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal">
            {editor.mode === "create" ? "Create Topic" : "Edit Topic"}
          </h2>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="lg" disabled={isSaving} onClick={submit}>
            {isSaving ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Pencil data-icon="inline-start" />
            )}
            Save Topic
          </Button>
        </div>
      </header>

      <section className="grid gap-5">
        <div className="flex flex-col gap-5">
          <FormSection title="Topic Brief">
            <Field label="Topic Name" error={errors.name}>
              <input
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                className="h-12 w-full rounded-2xl border border-transparent bg-input/50 px-4 text-base outline-none transition-[background-color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                placeholder="e.g. Travel Poster Study"
              />
            </Field>
          </FormSection>

          <FormSection title="Creative Direction">
            <Field label="Description / Topic Instruction" error={errors.instruction}>
              <Textarea
                value={draft.instruction}
                onChange={(event) =>
                  updateCreativeDirection(event.target.value)
                }
                rows={7}
                className="min-h-44 resize-y"
                placeholder="Describe what this topic is about and the direction every generation should follow."
              />
            </Field>
          </FormSection>
        </div>

        <aside className="flex flex-col gap-5">
          <FormSection title="Generation Defaults">
            <div className="flex flex-col gap-5">
              <AspectRatioPicker
                value={draft.defaultAspectRatio}
                onChange={(value) => updateDraft("defaultAspectRatio", value)}
              />

              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-semibold"
                  htmlFor="topic-enhancer-mode"
                >
                  Enhancer Mode
                </label>
                <Select
                  value={draft.enhancerMode}
                  onValueChange={(value) =>
                    updateDraft("enhancerMode", value as EnhancerMode)
                  }
                >
                  <SelectTrigger
                    id="topic-enhancer-mode"
                    className="w-full"
                    aria-label="Enhancer Mode"
                  >
                    <SelectValue placeholder="Select enhancer mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {enhancerModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <Field label="Base Prompt Details">
                <Textarea
                  value={draft.basePromptDetails}
                  onChange={(event) =>
                    updateDraft("basePromptDetails", event.target.value)
                  }
                  rows={6}
                  className="min-h-40 resize-y"
                />
              </Field>
            </div>
          </FormSection>
        </aside>
      </section>
    </div>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card/70 p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : null}
    </label>
  )
}

function SettingsScreen() {
  const [health, setHealth] = useState<{
    dataDir: string
    dbPath?: string
    codexAppServerConfigured: boolean
    codexAppServerCommand?: string
  } | null>(null)
  const [archivedTopics, setArchivedTopics] = useState<Array<TopicSummary>>([])
  const [isLoadingArchivedTopics, setIsLoadingArchivedTopics] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setIsLoadingArchivedTopics(true)
      try {
        const [healthResponse, topicsResponse] = await Promise.all([
          fetch(framebookApiUrl("/api/health")).then((response) => response.json()),
          framebookApi.listTopics({ includeArchived: true }),
        ])

        if (cancelled) return

        setHealth(healthResponse)
        setArchivedTopics(
          topicsResponse.topics.filter((topic) => Boolean(topic.archivedAt)),
        )
      } catch {
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <div className="mt-6 rounded-md border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Monitor className="size-5 text-primary" />
          <div>
            <div className="font-semibold">Local workspace</div>
            <div className="text-sm text-muted-foreground">
              Topic metadata and generated files stay on this machine.
            </div>
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Data directory</dt>
            <dd className="mt-1 break-all font-medium">{health?.dataDir ?? "Loading..."}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">SQLite database</dt>
            <dd className="mt-1 break-all font-medium">{health?.dbPath ?? "Loading..."}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Codex App Server</dt>
            <dd className="mt-1 font-medium">
              {health?.codexAppServerConfigured
                ? `Using ${health.codexAppServerCommand ?? "codex"} app-server`
                : "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Change workspace</dt>
            <dd className="mt-1 text-muted-foreground">
              Set <code className="font-mono text-foreground">FRAMEBOOK_DATA_DIR</code> before
              starting Framebook.
            </dd>
          </div>
        </dl>
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Archived topics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Topics you archived stay local and hidden from the main Topics view.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
            {archivedTopics.length}
          </span>
        </div>

        {isLoadingArchivedTopics ? (
          <div className="mt-4 space-y-3" aria-label="Loading archived topics">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {!isLoadingArchivedTopics && archivedTopics.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No archived topics yet.
          </div>
        ) : null}

        {!isLoadingArchivedTopics && archivedTopics.length > 0 ? (
          <div className="mt-4 divide-y rounded-md border">
            {archivedTopics.map((topic) => (
              <div
                key={topic.id}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="font-semibold">{topic.name}</div>
                  {topic.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {topic.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{topic.imageCount} images</span>
                    <span>{topic.defaultAspectRatio}</span>
                    <span>{modeLabel(topic.enhancerMode)}</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <div>Archived</div>
                  <div className="mt-1 font-medium text-foreground">
                    {topic.archivedAt ? formatDate(topic.archivedAt) : "Unknown"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function EmptyPanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-md border border-dashed bg-card p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">{body}</p>
        <button
          type="button"
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-medium text-primary hover:bg-primary/10"
          onClick={onAction}
        >
          <Plus className="size-4" />
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-accent"
      onClick={onClick}
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function modeLabel(mode: EnhancerMode) {
  return enhancerModeOptions.find((option) => option.value === mode)?.label ?? mode
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function imageFileUrl(imageId: string) {
  return framebookApiUrl(`/api/images/${encodeURIComponent(imageId)}/file`)
}

function imageDownloadName(image: ImageRecord) {
  const baseName = image.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 80)

  return `${baseName || "framebook-image"}.png`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function routeForScreen(screen: Screen, topicId?: string | null) {
  if (screen === "settings") {
    return "/settings"
  }

  if (screen === "gallery") {
    return "/gallery"
  }

  if (screen === "topic-editor") {
    return topicId ? `/topics/${encodeURIComponent(topicId)}/edit` : "/topics/new"
  }

  if (screen === "topic" && topicId) {
    return `/topics/${encodeURIComponent(topicId)}`
  }

  return "/topics"
}
