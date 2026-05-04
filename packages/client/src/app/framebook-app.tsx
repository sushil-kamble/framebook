import { useLocation, useNavigate } from "@tanstack/react-router"
import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
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
  routeStateFromPathname,
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

const generationToastId = "generation"
const promptEnhancementToastId = "prompt-enhancement"

export function FramebookApp({
  routeScreen,
  routeTopicId,
  routeImageId,
}: FramebookAppProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = useMemo(
    () => routeStateFromPathname(location.pathname),
    [location.pathname]
  )
  const currentRouteScreen = routeScreen ?? routeState.routeScreen
  const currentRouteTopicId = routeTopicId ?? routeState.routeTopicId
  const currentRouteImageId = routeImageId ?? routeState.routeImageId
  const { themeMode, setThemeMode } = useThemeMode()
  const [topics, setTopics] = useState<Array<TopicSummary>>([])
  const [images, setImages] = useState<Array<ImageRecord>>([])
  const [starredImages, setStarredImages] = useState<Array<ImageRecord>>([])
  const [activeTopicId, setActiveTopicId] = useState<string | null>(
    currentRouteTopicId ?? null
  )
  const screen = currentRouteScreen
  const [topicEditor, setTopicEditor] = useState<{
    mode: "create" | "edit"
    topicId?: string
    topicName?: string
    draft: TopicDraft
  } | null>(null)
  const [userPrompt, setUserPrompt] = useState("")
  const [generationPrompt, setGenerationPrompt] = useState("")
  const [promptMode, setPromptMode] = useState<"user" | "generation">("user")
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<AspectRatio>("16:9")
  const [selectedResolutionPreset, setSelectedResolutionPreset] =
    useState<ResolutionPreset>("1k")
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(true)
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isLoadingStarredImages, setIsLoadingStarredImages] = useState(() =>
    isStarredImagesScreen(currentRouteScreen)
  )
  const [hasLoadedStarredImages, setHasLoadedStarredImages] = useState(false)
  const [isLoadingImageDetail, setIsLoadingImageDetail] = useState(
    () => currentRouteScreen === "image-detail" && Boolean(currentRouteImageId)
  )
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
      images.find((image) => image.id === currentRouteImageId) ??
      (detailImage?.id === currentRouteImageId ? detailImage : null),
    [currentRouteImageId, detailImage, images]
  )
  const togglePreviewImage = useCallback((image: ImageRecord) => {
    setPreviewImageId((current) => (current === image.id ? null : image.id))
  }, [])
  const promptValue =
    promptMode === "generation" ? generationPrompt : userPrompt
  const isLoadingActiveTopic =
    screen === "topic" &&
    Boolean(currentRouteTopicId ?? activeTopicId) &&
    isLoadingTopics &&
    !activeTopic
  const activeGenerationJobId =
    job && isActiveGenerationJob(job) ? job.id : null
  const isStarredImagesLoading =
    isLoadingStarredImages ||
    (isStarredImagesScreen(screen) && !hasLoadedStarredImages)
  const isLoadingActiveImageDetail =
    screen === "image-detail" &&
    Boolean(currentRouteImageId) &&
    isLoadingImageDetail &&
    !activeDetailImage
  const isImmersiveScreen = screen === "settings" || screen === "topic-editor"

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
      setHasLoadedStarredImages(true)
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
        toast.dismiss(generationToastId)
        toast.success("Image generated")
        return
      }

      if (finishedJob.status === "failed") {
        toast.dismiss(generationToastId)
        toast.error("Generation failed", {
          description: finishedJob.error ?? "Your prompt is safe to retry.",
        })
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
    setError(null)

    if (currentRouteTopicId) {
      setActiveTopicId(currentRouteTopicId)
    }

    if (currentRouteScreen !== "image-detail") {
      setDetailImage(null)
      setImageDetailBackScreen(null)
    }

    if (currentRouteScreen === "topic-editor" && !currentRouteTopicId) {
      setTopicEditor({ mode: "create", draft: defaultTopicDraft })
    }
  }, [currentRouteScreen, currentRouteTopicId])

  useEffect(() => {
    if (currentRouteScreen !== "topic-editor" || !currentRouteTopicId) {
      return
    }

    const topic = topics.find(
      (candidate) => candidate.id === currentRouteTopicId
    )
    if (!topic) {
      return
    }

    setTopicEditor({
      mode: "edit",
      topicId: topic.id,
      topicName: topic.name,
      draft: draftFromTopic(topic),
    })
  }, [currentRouteScreen, currentRouteTopicId, topics])

  const activeTopicDefaultAspectRatio = activeTopic?.defaultAspectRatio
  useEffect(() => {
    if (!activeTopicId || !activeTopicDefaultAspectRatio) {
      return
    }
    setSelectedAspectRatio(activeTopicDefaultAspectRatio)
    void loadImages(activeTopicId, favoriteOnly)
  }, [activeTopicId, activeTopicDefaultAspectRatio, favoriteOnly, loadImages])

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
    if (currentRouteScreen !== "image-detail" || !currentRouteImageId) {
      setIsLoadingImageDetail(false)
      return
    }

    let cancelled = false
    const imageId = currentRouteImageId

    async function loadImageDetail() {
      setIsLoadingImageDetail(true)
      setDetailImage((currentImage) =>
        currentImage?.id === imageId ? currentImage : null
      )

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
      } finally {
        if (!cancelled) {
          setIsLoadingImageDetail(false)
        }
      }
    }

    void loadImageDetail()

    return () => {
      cancelled = true
    }
  }, [currentRouteImageId, currentRouteScreen])

  const navigateTo = (nextScreen: Screen, topicId?: string | null) => {
    const target = routeForScreen(
      nextScreen,
      topicId === undefined ? activeTopicId : topicId
    )
    void navigate({
      to: target,
      viewTransition: true,
    } as Parameters<typeof navigate>[0])
  }

  const openImageDetail = (image: ImageRecord) => {
    setDetailImage(image)
    setImageDetailBackScreen(
      screen === "starred" || screen === "gallery" ? "starred" : "topic"
    )
    void navigate({
      to: `/topics/${encodeURIComponent(image.topicId)}/images/${encodeURIComponent(image.id)}`,
      viewTransition: true,
    } as Parameters<typeof navigate>[0])
  }

  const openTopic = (topic: TopicSummary, nextScreen: Screen = "topic") => {
    setActiveTopicId(topic.id)
    setSelectedAspectRatio(topic.defaultAspectRatio)
    setError(null)
    navigateTo(nextScreen, topic.id)
  }

  const startCreateTopic = () => {
    setTopicEditor({ mode: "create", draft: defaultTopicDraft })
    setError(null)
    navigateTo("topic-editor", null)
  }

  const startEditTopic = (topic: TopicSummary) => {
    setTopicEditor({
      mode: "edit",
      topicId: topic.id,
      topicName: topic.name,
      draft: draftFromTopic(topic),
    })
    setError(null)
    navigateTo("topic-editor", topic.id)
  }

  const submitTopic = async (draft: TopicDraft) => {
    const normalized = normalizeTopicDraft(draft)
    const isEdit = topicEditor?.mode === "edit" && topicEditor.topicId
    const response = isEdit
      ? await framebookApi.updateTopic(topicEditor.topicId!, normalized)
      : await framebookApi.createTopic(normalized)

    await loadTopics()
    setTopicEditor(null)
    openTopic(response.topic)
    toast.success(isEdit ? "Topic updated" : "Topic created", {
      description: response.topic.name,
    })
  }

  const archiveActiveTopic = async () => {
    if (!activeTopic) {
      return
    }

    const name = activeTopic.name
    await framebookApi.archiveTopic(activeTopic.id)
    setActiveTopicId(null)
    setImages([])
    navigateTo("topics")
    await loadTopics()
    toast("Topic archived", { description: name })
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
      toast.success("Topic restored", { description: response.topic.name })
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    }
  }

  const unarchiveImage = async (image: ImageRecord) => {
    try {
      const response = await framebookApi.updateImage(image.id, {
        archived: false,
      })
      setImages((current) =>
        current.some((candidate) => candidate.id === response.image.id)
          ? current.map((candidate) =>
              candidate.id === response.image.id ? response.image : candidate
            )
          : current
      )
      setStarredImages((current) =>
        updateStarredImages(current, response.image)
      )
      setDetailImage((current) =>
        current?.id === response.image.id ? response.image : current
      )
      await loadTopics()
      toast.success("Image restored", { description: response.image.title })
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    }
  }

  const enhanceCurrentPrompt = async () => {
    if (!activeTopic || !userPrompt.trim()) {
      return
    }

    setIsEnhancing(true)
    setError(null)
    toast("Enhancing prompt...", {
      id: promptEnhancementToastId,
    })
    try {
      const result = await framebookApi.enhancePrompt(activeTopic.id, {
        rawPrompt: userPrompt,
      })
      setGenerationPrompt(result.enhancedPrompt)
      setPromptMode("generation")
      toast.dismiss(promptEnhancementToastId)
      toast.success("Prompt enhanced")
    } catch (requestError) {
      toast.dismiss(promptEnhancementToastId)
      toast.error("Prompt enhancement failed")
      setError(errorMessage(requestError))
    } finally {
      setIsEnhancing(false)
    }
  }

  const updatePrompt = (value: string) => {
    if (promptMode === "generation") {
      setGenerationPrompt(value)
      return
    }

    setUserPrompt(value)
  }

  const generateCurrentPrompt = async () => {
    const submittedPromptValue =
      promptMode === "generation" ? generationPrompt : userPrompt

    if (!activeTopic || !submittedPromptValue.trim()) {
      return
    }

    setError(null)
    toast("Your image is being generated", {
      id: generationToastId,
    })
    try {
      const submittedUserPrompt =
        userPrompt.trim() || submittedPromptValue.trim()
      const submittedGenerationPrompt =
        promptMode === "generation" ? generationPrompt.trim() : ""
      const response = await framebookApi.createGeneration(activeTopic.id, {
        rawPrompt: submittedUserPrompt,
        enhancedPrompt: submittedGenerationPrompt,
        aspectRatio: selectedAspectRatio,
        resolutionPreset: selectedResolutionPreset,
      })
      setJob(response.job)
      setUserPrompt("")
      setGenerationPrompt("")
      setPromptMode("user")
    } catch (requestError) {
      toast.dismiss(generationToastId)
      toast.error("Image generation failed")
      setError(errorMessage(requestError))
    }
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
    toast(
      response.image.favorite ? "Added to favorites" : "Removed from favorites"
    )
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
      toast("Image archived")
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
        toast.success("Shared")
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

    if (copied) {
      toast.success("Link copied to clipboard")
    } else {
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
      toast.success("Image downloaded")
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
        <section
          className={
            isImmersiveScreen
              ? "min-w-0 flex-1"
              : "min-w-0 flex-1 px-4 py-4 md:px-6"
          }
        >
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

          <div className="framebook-page-stage">
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
                onTopicsClick={() => navigateTo("topics")}
                onTopicClick={() => {
                  navigateTo("topic", topicEditor.topicId ?? activeTopicId)
                }}
                onSubmit={submitTopic}
              />
            ) : null}

            {isLoadingActiveTopic ? <TopicWorkspaceSkeleton /> : null}

            {screen === "topic" && activeTopic ? (
              <TopicWorkspace
                topic={activeTopic}
                images={images}
                promptValue={promptValue}
                selectedAspectRatio={selectedAspectRatio}
                selectedResolutionPreset={selectedResolutionPreset}
                favoriteOnly={favoriteOnly}
                job={job}
                isEnhancing={isEnhancing}
                isLoadingImages={isLoadingImages}
                onBack={() => navigateTo("topics")}
                onEditTopic={() => startEditTopic(activeTopic)}
                onArchiveTopic={archiveActiveTopic}
                onPromptChange={updatePrompt}
                onAspectRatioChange={setSelectedAspectRatio}
                onResolutionPresetChange={setSelectedResolutionPreset}
                onEnhancePrompt={enhanceCurrentPrompt}
                onGenerate={generateCurrentPrompt}
                onToggleFavorite={toggleFavorite}
                onRevealImage={(image) => framebookApi.revealImage(image.id)}
                onPreviewImage={togglePreviewImage}
                onViewImageDetails={openImageDetail}
                onDownloadImage={downloadImage}
                onFavoriteFilterChange={setFavoriteOnly}
              />
            ) : null}

            {screen === "starred" || screen === "gallery" ? (
              <StarredScreen
                images={starredImages}
                isLoading={isStarredImagesLoading}
                onToggleFavorite={toggleFavorite}
                onPreviewImage={togglePreviewImage}
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
              <SettingsScreen
                onUnarchiveImage={unarchiveImage}
                onUnarchiveTopic={unarchiveTopic}
              />
            ) : null}

            {screen === "image-detail" ? (
              <ImageDetailPage
                image={isLoadingActiveImageDetail ? null : activeDetailImage}
                onTopicsClick={() => navigateTo("topics")}
                onBack={() => {
                  const topicId = activeDetailImage?.topicId ?? activeTopicId
                  navigateTo(
                    imageDetailBackScreen === "starred" ? "starred" : "topic",
                    topicId ?? undefined
                  )
                }}
                onRevealImage={(image) => framebookApi.revealImage(image.id)}
                onPreviewImage={togglePreviewImage}
                onDownloadImage={downloadImage}
                onShareImage={shareImage}
              />
            ) : null}
          </div>
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

function isStarredImagesScreen(screen: Screen) {
  return screen === "starred" || screen === "gallery"
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
