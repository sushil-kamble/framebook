import { useNavigate } from "@tanstack/react-router"
import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  defaultTopicDraft,
  draftFromTopic,
  normalizeTopicDraft,
} from "@app/lib/topic-form"
import { framebookApi } from "@shared/api/framebook"
import { Sidebar } from "./components/app-sidebar"
import { EmptyPanel } from "./components/empty-panel"
import { ImageDetailPage } from "./components/image-detail-page"
import { ImagePreviewDialog } from "./components/image-preview-dialog"
import { SettingsScreen } from "./components/settings-screen"
import { StarredScreen } from "./components/starred-screen"
import { TopicEditorPage } from "./components/topic-editor-page"
import {
  TopicWorkspace,
  TopicWorkspaceSkeleton,
} from "./components/topic-workspace"
import { TopicsScreen } from "./components/topics-screen"
import { generationPollIntervalMs } from "./lib/constants"
import {
  errorMessage,
  imageDownloadName,
  imageFileUrl,
  routeForScreen,
} from "./lib/utils"
import { useThemeMode } from "./lib/theme"
import { copyTextToClipboard } from "./lib/share"
import type { FramebookAppProps, Screen } from "./lib/types"
import type { TopicDraft } from "@app/lib/topic-form"
import type {
  AspectRatio,
  GenerationJob,
  ImageRecord,
  ResolutionPreset,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"

export function FramebookApp({
  routeScreen = "topics",
  routeTopicId,
  routeImageId,
}: FramebookAppProps = {}) {
  const navigate = useNavigate()
  const { themeMode, setThemeMode } = useThemeMode()
  const [topics, setTopics] = useState<Array<TopicSummary>>([])
  const [images, setImages] = useState<Array<ImageRecord>>([])
  const [starredImages, setStarredImages] = useState<Array<ImageRecord>>([])
  const [activeTopicId, setActiveTopicId] = useState<string | null>(
    routeTopicId ?? null
  )
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
  const [selectedResolutionPreset, setSelectedResolutionPreset] =
    useState<ResolutionPreset>("1k")
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(true)
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isLoadingStarredImages, setIsLoadingStarredImages] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const [detailImage, setDetailImage] = useState<ImageRecord | null>(null)
  const [imageDetailBackScreen, setImageDetailBackScreen] =
    useState<Screen | null>(null)

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId) ?? null,
    [activeTopicId, topics]
  )
  const previewImage = useMemo(
    () =>
      images.find((image) => image.id === previewImageId) ??
      starredImages.find((image) => image.id === previewImageId) ??
      (detailImage?.id === previewImageId ? detailImage : null),
    [detailImage, images, previewImageId, starredImages]
  )
  const activeDetailImage = useMemo(
    () =>
      images.find((image) => image.id === routeImageId) ?? detailImage ?? null,
    [detailImage, images, routeImageId]
  )
  const isLoadingActiveTopic =
    screen === "topic" &&
    Boolean(routeTopicId ?? activeTopicId) &&
    isLoadingTopics &&
    !activeTopic
  const activeGenerationJobId =
    job && isActiveGenerationJob(job) ? job.id : null

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

  const loadImages = useCallback(
    async (topicId: string, onlyFavorites: boolean) => {
      setIsLoadingImages(true)
      try {
        const response = await framebookApi.listImages(topicId, onlyFavorites)
        setImages(response.images)
      } catch (requestError) {
        setError(errorMessage(requestError))
      } finally {
        setIsLoadingImages(false)
      }
    },
    []
  )

  const loadStarredImages = useCallback(async () => {
    setIsLoadingStarredImages(true)
    try {
      const response = await framebookApi.listStarredImages()
      setStarredImages(response.images)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setIsLoadingStarredImages(false)
    }
  }, [])

  const finishGenerationJob = useCallback(
    async (finishedJob: GenerationJob) => {
      if (finishedJob.status === "succeeded") {
        await Promise.all([
          loadTopics(),
          activeTopicId === finishedJob.topicId
            ? loadImages(finishedJob.topicId, favoriteOnly)
            : Promise.resolve(),
        ])
        return
      }

      if (finishedJob.status === "failed") {
        setError(
          finishedJob.error || "Generation failed, but your prompt is safe."
        )
      }
    },
    [activeTopicId, favoriteOnly, loadImages, loadTopics]
  )

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
      setImageDetailBackScreen(null)
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
    if (screen === "starred" || screen === "gallery") {
      void loadStarredImages()
    }
  }, [loadStarredImages, screen])

  useEffect(() => {
    if (!activeTopic?.id) {
      setJob(null)
      return
    }

    let cancelled = false
    const topicId = activeTopic.id

    async function reconnectActiveGeneration() {
      try {
        const response = await framebookApi.listGenerationJobs(topicId, {
          activeOnly: true,
        })

        if (cancelled) {
          return
        }

        const activeJob = response.jobs.length > 0 ? response.jobs[0] : null
        setJob((current) => {
          if (current?.topicId === topicId && isActiveGenerationJob(current)) {
            return current
          }

          if (activeJob) {
            return activeJob
          }

          return current?.topicId === topicId ? current : null
        })

        if (!activeJob) {
          await Promise.all([loadTopics(), loadImages(topicId, favoriteOnly)])
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(errorMessage(requestError))
        }
      }
    }

    void reconnectActiveGeneration()

    return () => {
      cancelled = true
    }
  }, [activeTopic?.id, favoriteOnly, loadImages, loadTopics])

  useEffect(() => {
    if (!activeGenerationJobId) {
      return
    }

    let cancelled = false
    const jobId = activeGenerationJobId

    async function pollActiveGeneration() {
      try {
        const response = await framebookApi.getGenerationJob(jobId)

        if (cancelled) {
          return
        }

        setJob(response.job)

        if (!isActiveGenerationJob(response.job)) {
          await finishGenerationJob(response.job)
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(errorMessage(requestError))
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void pollActiveGeneration()
    }, generationPollIntervalMs)
    void pollActiveGeneration()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeGenerationJobId, finishGenerationJob])

  useEffect(() => {
    if (activeTopic?.id) {
      setSelectedResolutionPreset("1k")
    }
  }, [activeTopic?.id])

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
    setImageDetailBackScreen(
      screen === "starred" || screen === "gallery" ? "starred" : "topic"
    )
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

  const unarchiveTopic = async (topic: TopicSummary) => {
    try {
      const response = await framebookApi.unarchiveTopic(topic.id)
      setTopics((current) =>
        current.some((candidate) => candidate.id === response.topic.id)
          ? current.map((candidate) =>
              candidate.id === response.topic.id ? response.topic : candidate
            )
          : [response.topic, ...current]
      )
      await loadTopics()
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    }
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
      const submittedPrompt = rawPrompt.trim()
      const submittedEnhancedPrompt = enhancedPrompt.trim()
      const response = await framebookApi.createGeneration(activeTopic.id, {
        rawPrompt: submittedPrompt,
        enhancedPrompt: submittedEnhancedPrompt,
        aspectRatio: selectedAspectRatio,
        resolutionPreset: selectedResolutionPreset,
      })
      setJob(response.job)
      setRawPrompt("")
      setEnhancedPrompt("")
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
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
  }

  const toggleFavorite = async (image: ImageRecord) => {
    const response = await framebookApi.updateImage(image.id, {
      favorite: !image.favorite,
    })
    setImages((current) =>
      current.map((candidate) =>
        candidate.id === response.image.id ? response.image : candidate
      )
    )
    setStarredImages((current) => updateStarredImages(current, response.image))
    setDetailImage((current) =>
      current?.id === response.image.id ? response.image : current
    )
    await loadTopics()
  }

  const archiveImage = async (image: ImageRecord) => {
    try {
      const response = await framebookApi.updateImage(image.id, {
        archived: true,
      })
      setImages((current) =>
        current.filter((candidate) => candidate.id !== response.image.id)
      )
      setStarredImages((current) =>
        current.filter((candidate) => candidate.id !== response.image.id)
      )
      setDetailImage((current) =>
        current?.id === response.image.id ? null : current
      )
      setPreviewImageId((current) =>
        current === response.image.id ? null : current
      )
      await loadTopics()
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  const shareImage = async (image: ImageRecord) => {
    const url = new URL(imageFileUrl(image.id), window.location.href).toString()

    if ("share" in navigator && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: image.title,
          text: image.rawPrompt,
          url,
        })
        return
      } catch (shareError) {
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return
        }
      }
    }

    const copied = await copyTextToClipboard(url)

    if (!copied) {
      setError(
        "Could not copy the share link automatically. Open the image and copy the URL from the address bar."
      )
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
          themeMode={themeMode}
          onNavigate={navigateTo}
          onCreateTopic={startCreateTopic}
          onThemeModeChange={setThemeMode}
        />
        <section className="min-w-0 flex-1 px-4 py-4 md:px-6">
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

          {isLoadingActiveTopic ? <TopicWorkspaceSkeleton /> : null}

          {screen === "topic" && activeTopic ? (
            <TopicWorkspace
              topic={activeTopic}
              images={images}
              rawPrompt={rawPrompt}
              enhancedPrompt={enhancedPrompt}
              selectedAspectRatio={selectedAspectRatio}
              selectedResolutionPreset={selectedResolutionPreset}
              favoriteOnly={favoriteOnly}
              job={job}
              isEnhancing={isEnhancing}
              isLoadingImages={isLoadingImages}
              onBack={() => navigateTo("topics")}
              onEditTopic={() => startEditTopic(activeTopic)}
              onArchiveTopic={archiveActiveTopic}
              onRawPromptChange={setRawPrompt}
              onAspectRatioChange={setSelectedAspectRatio}
              onResolutionPresetChange={setSelectedResolutionPreset}
              onEnhancePrompt={enhanceCurrentPrompt}
              onGenerate={generateCurrentPrompt}
              onToggleFavorite={toggleFavorite}
              onRevealImage={(image) => framebookApi.revealImage(image.id)}
              onPreviewImage={(image) => {
                setPreviewImageId(image.id)
              }}
              onViewImageDetails={openImageDetail}
              onDownloadImage={downloadImage}
              onFavoriteFilterChange={setFavoriteOnly}
            />
          ) : null}

          {screen === "starred" || screen === "gallery" ? (
            <StarredScreen
              images={starredImages}
              isLoading={isLoadingStarredImages}
              onToggleFavorite={toggleFavorite}
              onPreviewImage={(image) => {
                setPreviewImageId(image.id)
              }}
              onViewImageDetails={openImageDetail}
            />
          ) : null}

          {screen === "topic" && !activeTopic && !isLoadingActiveTopic ? (
            <EmptyPanel
              title="Choose a topic"
              body="Create or open a topic before generating images."
              actionLabel="Go to topics"
              onAction={() => navigateTo("topics")}
            />
          ) : null}

          {screen === "settings" ? (
            <SettingsScreen onUnarchiveTopic={unarchiveTopic} />
          ) : null}

          {screen === "image-detail" ? (
            <ImageDetailPage
              image={activeDetailImage}
              onBack={() => {
                const topicId = activeDetailImage?.topicId ?? activeTopicId
                navigateTo(
                  imageDetailBackScreen === "starred" ? "starred" : "topic",
                  topicId ?? undefined
                )
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
        onArchiveImage={archiveImage}
      />
    </main>
  )
}

function isActiveGenerationJob(job: GenerationJob) {
  return job.status === "queued" || job.status === "running"
}

function updateStarredImages(current: Array<ImageRecord>, image: ImageRecord) {
  if (!image.favorite || image.archivedAt) {
    return current.filter((candidate) => candidate.id !== image.id)
  }

  const next = current.some((candidate) => candidate.id === image.id)
    ? current.map((candidate) =>
        candidate.id === image.id ? image : candidate
      )
    : [image, ...current]

  return next.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )
}
