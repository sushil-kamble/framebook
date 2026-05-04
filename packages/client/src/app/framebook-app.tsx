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
import { TopicEditorPage } from "./components/topic-editor-page"
import {
  TopicWorkspace,
  TopicWorkspaceSkeleton,
} from "./components/topic-workspace"
import { TopicsScreen } from "./components/topics-screen"
import {
  generationPollAttempts,
  generationPollIntervalMs,
} from "./lib/constants"
import {
  delay,
  errorMessage,
  imageDownloadName,
  imageFileUrl,
  routeForScreen,
} from "./lib/utils"
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
  const [topics, setTopics] = useState<Array<TopicSummary>>([])
  const [images, setImages] = useState<Array<ImageRecord>>([])
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
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const [detailImage, setDetailImage] = useState<ImageRecord | null>(null)

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId) ?? null,
    [activeTopicId, topics]
  )
  const previewImage = useMemo(
    () =>
      images.find((image) => image.id === previewImageId) ??
      (detailImage?.id === previewImageId ? detailImage : null),
    [detailImage, images, previewImageId]
  )
  const activeDetailImage = useMemo(
    () =>
      images.find((image) => image.id === routeImageId) ?? detailImage ?? null,
    [detailImage, images, routeImageId]
  )
  const isLoadingActiveTopic =
    (screen === "topic" || screen === "gallery") &&
    Boolean(routeTopicId ?? activeTopicId) &&
    isLoadingTopics &&
    !activeTopic

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
      const response = await framebookApi.createGeneration(activeTopic.id, {
        rawPrompt,
        enhancedPrompt: enhancedPrompt.trim(),
        aspectRatio: selectedAspectRatio,
        resolutionPreset: selectedResolutionPreset,
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
          activeTopic
            ? loadImages(activeTopic.id, favoriteOnly)
            : Promise.resolve(),
        ])
        return
      }

      if (response.job.status === "failed") {
        setError(
          response.job.error || "Generation failed, but your prompt is safe."
        )
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
        candidate.id === response.image.id ? response.image : candidate
      )
    )
    setDetailImage((current) =>
      current?.id === response.image.id ? response.image : current
    )
    await loadTopics()
  }

  const shareImage = async (image: ImageRecord) => {
    const url = new URL(imageFileUrl(image.id), window.location.href).toString()

    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({
          title: image.title,
          text: image.rawPrompt,
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
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

          {isLoadingActiveTopic ? <TopicWorkspaceSkeleton /> : null}

          {(screen === "topic" || screen === "gallery") && activeTopic ? (
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
              onShareImage={shareImage}
              onFavoriteFilterChange={setFavoriteOnly}
            />
          ) : null}

          {(screen === "topic" || screen === "gallery") &&
          !activeTopic &&
          !isLoadingActiveTopic ? (
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
