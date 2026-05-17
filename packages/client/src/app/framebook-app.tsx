import { useLocation, useNavigate } from "@tanstack/react-router"
import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  clearNewTopicDraft,
  defaultTopicDraft,
  draftFromTopic,
  loadNewTopicDraft,
  normalizeTopicDraft,
  saveNewTopicDraft,
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
  generationStartedToastMessage,
  generationSucceededToastMessage,
  generationToastId,
  isActiveGenerationJob,
  promptEnhancementToastId,
} from "./lib/generation"
import {
  isStarredImagesScreen,
  updateStarredImages,
} from "./lib/image-collections"
import {
  isReferenceImageFile,
  isReferenceImageTooLarge,
  referenceImageConfig,
  referenceImageMessages,
} from "./lib/reference-images"
import {
  createClientId,
  createObjectUrl,
  errorMessage,
  imageDownloadName,
  imageFileUrl,
  revokeObjectUrl,
  routeForScreen,
  routeStateFromPathname,
} from "./lib/utils"
import { useThemeMode } from "./lib/theme"
import { copyTextToClipboard } from "./lib/share"
import type {
  FramebookAppProps,
  PromptReferenceImageAttachment,
  Screen,
} from "./lib/types"
import type { TopicDraft } from "@app/lib/topic-form"
import type {
  AspectRatio,
  GenerationJob,
  GenerationVersionCount,
  ImageRecord,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"

interface PendingGenerationRequest {
  id: string
  topicId: string
  versionCount: GenerationVersionCount
}

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
    referenceImages?: TopicSummary["referenceImages"]
  } | null>(null)
  const [userPrompt, setUserPrompt] = useState("")
  const [generationPrompt, setGenerationPrompt] = useState("")
  const [promptMode, setPromptMode] = useState<"user" | "generation">("user")
  const [researchContextEnabled, setResearchContextEnabled] = useState(false)
  const [promptReferenceImages, setPromptReferenceImages] = useState<
    Array<PromptReferenceImageAttachment>
  >([])
  const promptReferenceImagesRef = useRef(promptReferenceImages)
  const [excludedTopicReferenceImageIds, setExcludedTopicReferenceImageIds] =
    useState<Set<string>>(() => new Set())
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<AspectRatio>("16:9")
  const [selectedVersionCount, setSelectedVersionCount] =
    useState<GenerationVersionCount>(1)
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
  const [pendingGenerationRequests, setPendingGenerationRequests] = useState<
    Array<PendingGenerationRequest>
  >([])
  const [jobs, setJobs] = useState<Array<GenerationJob>>([])
  const jobsRef = useRef(jobs)
  const refreshedGenerationJobIdsRef = useRef(new Set<string>())
  const notifiedGenerationJobIdsRef = useRef(new Set<string>())
  const [error, setError] = useState<string | null>(null)
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const [detailImage, setDetailImage] = useState<ImageRecord | null>(null)
  const [imageDetailBackScreen, setImageDetailBackScreen] =
    useState<Screen | null>(null)

  const getNewTopicDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return defaultTopicDraft
    }

    return loadNewTopicDraft(window.sessionStorage)
  }, [])

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId) ?? null,
    [activeTopicId, topics]
  )
  const selectedTopicReferenceImages = useMemo(() => {
    if (!activeTopic) {
      return []
    }

    return activeTopic.referenceImages.filter(
      (referenceImage) => !excludedTopicReferenceImageIds.has(referenceImage.id)
    )
  }, [activeTopic, excludedTopicReferenceImageIds])
  const previewImage = useMemo(
    () =>
      images.find((image) => image.id === previewImageId) ??
      starredImages.find((image) => image.id === previewImageId) ??
      (detailImage?.id === previewImageId ? detailImage : null),
    [detailImage, images, previewImageId, starredImages]
  )
  const previewImages = useMemo(() => {
    if (!previewImage) {
      return []
    }

    if (screen === "topic") {
      return images.some((image) => image.id === previewImage.id)
        ? images
        : [previewImage]
    }

    if (isStarredImagesScreen(screen)) {
      return starredImages.some((image) => image.id === previewImage.id)
        ? starredImages
        : [previewImage]
    }

    return [previewImage]
  }, [images, previewImage, screen, starredImages])
  const activeDetailImage = useMemo(
    () =>
      images.find((image) => image.id === currentRouteImageId) ??
      (detailImage?.id === currentRouteImageId ? detailImage : null),
    [currentRouteImageId, detailImage, images]
  )
  const togglePreviewImage = useCallback((image: ImageRecord) => {
    setPreviewImageId((current) => (current === image.id ? null : image.id))
  }, [])
  const cyclePreviewImage = useCallback(
    (direction: -1 | 1) => {
      if (!previewImageId || previewImages.length <= 1) {
        return
      }

      const currentIndex = previewImages.findIndex(
        (image) => image.id === previewImageId
      )
      const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex
      const nextIndex =
        (safeCurrentIndex + direction + previewImages.length) %
        previewImages.length

      setPreviewImageId(previewImages[nextIndex]?.id ?? previewImageId)
    },
    [previewImageId, previewImages]
  )
  const promptValue =
    promptMode === "generation" ? generationPrompt : userPrompt
  const isLoadingActiveTopic =
    screen === "topic" &&
    Boolean(currentRouteTopicId ?? activeTopicId) &&
    isLoadingTopics &&
    !activeTopic
  const activeGenerationJobs = useMemo(
    () => jobs.filter(isActiveGenerationJob),
    [jobs]
  )
  const activeGenerationJobIds = useMemo(
    () => activeGenerationJobs.map((generationJob) => generationJob.id),
    [activeGenerationJobs]
  )
  const activeTopicGenerationJobs = useMemo(
    () =>
      activeTopic
        ? jobs.filter(
            (generationJob) => generationJob.topicId === activeTopic.id
          )
        : [],
    [activeTopic, jobs]
  )
  const pendingActiveTopicGenerationVersionCount = useMemo(
    () =>
      activeTopic
        ? pendingGenerationRequests
            .filter((request) => request.topicId === activeTopic.id)
            .reduce((count, request) => count + request.versionCount, 0)
        : 0,
    [activeTopic, pendingGenerationRequests]
  )
  const isStarredImagesLoading =
    isLoadingStarredImages ||
    (isStarredImagesScreen(screen) && !hasLoadedStarredImages)
  const isLoadingActiveImageDetail =
    screen === "image-detail" &&
    Boolean(currentRouteImageId) &&
    isLoadingImageDetail &&
    !activeDetailImage
  const isImmersiveScreen = screen === "settings" || screen === "topic-editor"

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  useEffect(() => {
    promptReferenceImagesRef.current = promptReferenceImages
  }, [promptReferenceImages])

  useEffect(() => {
    return () => {
      for (const referenceImage of promptReferenceImagesRef.current) {
        revokeObjectUrl(referenceImage.previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    setExcludedTopicReferenceImageIds(new Set())
    setPromptReferenceImages((current) => {
      for (const referenceImage of current) {
        revokeObjectUrl(referenceImage.previewUrl)
      }

      return []
    })
  }, [activeTopicId])

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

  const refreshFinishedGenerationResults = useCallback(
    async (finishedJobs: Array<GenerationJob>) => {
      const topicIdsToRefresh = new Set(
        finishedJobs.map((generationJob) => generationJob.topicId)
      )

      await Promise.all([
        loadTopics(),
        ...Array.from(topicIdsToRefresh).map((topicId) =>
          activeTopicId === topicId
            ? loadImages(topicId, favoriteOnly)
            : Promise.resolve()
        ),
      ])
    },
    [activeTopicId, favoriteOnly, loadImages, loadTopics]
  )

  const finishGenerationJobs = useCallback(
    (finishedJobs: Array<GenerationJob>) => {
      const succeededJobs = finishedJobs.filter(
        (generationJob) => generationJob.status === "succeeded"
      )
      const failedJobs = finishedJobs.filter(
        (generationJob) => generationJob.status === "failed"
      )

      toast.dismiss(generationToastId)

      if (failedJobs.length === 0) {
        toast.success(generationSucceededToastMessage(succeededJobs.length))
        return
      }

      if (succeededJobs.length > 0) {
        toast.error("Some generations failed", {
          description: `${succeededJobs.length} succeeded, ${failedJobs.length} failed.`,
        })
        setError(failedJobs[0]?.error || "Some generations failed.")
        return
      }

      toast.error("Generation failed", {
        description: failedJobs[0]?.error ?? "Your prompt is safe to retry.",
      })
      setError(
        failedJobs[0]?.error || "Generation failed, but your prompt is safe."
      )
    },
    []
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
      setTopicEditor({ mode: "create", draft: getNewTopicDraft() })
    }
  }, [currentRouteScreen, currentRouteTopicId, getNewTopicDraft])

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
      referenceImages: topic.referenceImages,
    })
  }, [currentRouteScreen, currentRouteTopicId, topics])

  const activeTopicDefaultAspectRatio = activeTopic?.defaultAspectRatio
  useEffect(() => {
    if (!activeTopicId || !activeTopicDefaultAspectRatio) {
      return
    }
    setSelectedAspectRatio(activeTopicDefaultAspectRatio)
    void loadImages(activeTopicId, favoriteOnly)
  }, [activeTopicDefaultAspectRatio, activeTopicId, favoriteOnly, loadImages])

  useEffect(() => {
    if (screen === "starred" || screen === "gallery") {
      void loadStarredImages()
    }
  }, [loadStarredImages, screen])

  useEffect(() => {
    if (!activeTopic?.id) {
      setJobs([])
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

        setJobs((currentJobs) => [
          ...currentJobs.filter(
            (generationJob) =>
              generationJob.topicId !== topicId ||
              !isActiveGenerationJob(generationJob)
          ),
          ...response.jobs,
        ])

        if (response.jobs.length === 0) {
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
    if (activeGenerationJobIds.length === 0) {
      return
    }

    let cancelled = false
    const jobIds = activeGenerationJobIds

    async function pollActiveGenerations() {
      try {
        const responses = await Promise.all(
          jobIds.map((jobId) => framebookApi.getGenerationJob(jobId))
        )
        const polledJobs = responses.map((response) => response.job)

        if (cancelled) {
          return
        }

        const nextJobs = jobsRef.current.map(
          (generationJob) =>
            polledJobs.find((polledJob) => polledJob.id === generationJob.id) ??
            generationJob
        )
        jobsRef.current = nextJobs
        setJobs(nextJobs)

        const finishedJobs = polledJobs.filter(
          (generationJob) => !isActiveGenerationJob(generationJob)
        )
        const newlyFinishedJobs = finishedJobs.filter(
          (generationJob) =>
            !refreshedGenerationJobIdsRef.current.has(generationJob.id)
        )

        if (newlyFinishedJobs.length > 0) {
          for (const generationJob of newlyFinishedJobs) {
            refreshedGenerationJobIdsRef.current.add(generationJob.id)
          }
          await refreshFinishedGenerationResults(newlyFinishedJobs)
        }

        const activeJobsAfterPoll = nextJobs.filter(isActiveGenerationJob)
        if (activeJobsAfterPoll.length === 0) {
          const finishedJobsToNotify = nextJobs.filter(
            (generationJob) =>
              !isActiveGenerationJob(generationJob) &&
              !notifiedGenerationJobIdsRef.current.has(generationJob.id)
          )

          if (finishedJobsToNotify.length > 0) {
            for (const generationJob of finishedJobsToNotify) {
              notifiedGenerationJobIdsRef.current.add(generationJob.id)
            }
            await finishGenerationJobs(finishedJobsToNotify)
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(errorMessage(requestError))
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void pollActiveGenerations()
    }, generationPollIntervalMs)
    void pollActiveGenerations()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    activeGenerationJobIds,
    finishGenerationJobs,
    refreshFinishedGenerationResults,
  ])

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

  const openPreviewImageDetail = (image: ImageRecord) => {
    setPreviewImageId(null)
    openImageDetail(image)
  }

  const openTopic = (topic: TopicSummary, nextScreen: Screen = "topic") => {
    setActiveTopicId(topic.id)
    setSelectedAspectRatio(topic.defaultAspectRatio)
    setError(null)
    navigateTo(nextScreen, topic.id)
  }

  const startCreateTopic = () => {
    setTopicEditor({ mode: "create", draft: getNewTopicDraft() })
    setError(null)
    navigateTo("topic-editor", null)
  }

  const startEditTopic = (topic: TopicSummary) => {
    setTopicEditor({
      mode: "edit",
      topicId: topic.id,
      topicName: topic.name,
      draft: draftFromTopic(topic),
      referenceImages: topic.referenceImages,
    })
    setError(null)
    navigateTo("topic-editor", topic.id)
  }

  const applyTopicUpdate = (topic: TopicSummary) => {
    setTopics((current) =>
      current.some((candidate) => candidate.id === topic.id)
        ? current.map((candidate) =>
            candidate.id === topic.id ? topic : candidate
          )
        : [topic, ...current]
    )
    setTopicEditor((current) =>
      current?.topicId === topic.id
        ? {
            ...current,
            topicName: topic.name,
            draft: draftFromTopic(topic),
            referenceImages: topic.referenceImages,
          }
        : current
    )
  }

  const submitTopic = async (
    draft: TopicDraft,
    referenceFiles: Array<File> = []
  ) => {
    const normalized = normalizeTopicDraft(draft)
    const isEdit = topicEditor?.mode === "edit" && topicEditor.topicId
    let response = isEdit
      ? await framebookApi.updateTopic(topicEditor.topicId!, normalized)
      : await framebookApi.createTopic(normalized)

    const validReferenceFiles = referenceImageFiles(referenceFiles)
    if (validReferenceFiles.length > 0) {
      response = await framebookApi.addTopicReferenceImages(
        response.topic.id,
        validReferenceFiles
      )
    }

    if (!isEdit && typeof window !== "undefined") {
      clearNewTopicDraft(window.sessionStorage)
    }

    await loadTopics()
    setTopicEditor(null)
    openTopic(response.topic)
    toast.success(isEdit ? "Topic updated" : "Topic created", {
      description: response.topic.name,
    })
  }

  const addTopicReferenceImages = async (
    topicId: string,
    files: Array<File>
  ) => {
    const validFiles = referenceImageFiles(files)

    if (validFiles.length === 0) {
      return
    }

    const response = await framebookApi.addTopicReferenceImages(
      topicId,
      validFiles
    )
    applyTopicUpdate(response.topic)
    toast.success("Reference images added")
  }

  const removeTopicReferenceImage = async (
    topicId: string,
    referenceImageId: string
  ) => {
    const response = await framebookApi.deleteTopicReferenceImage(
      topicId,
      referenceImageId
    )
    applyTopicUpdate(response.topic)
    toast.success("Reference image removed")
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

  const deleteImage = async (image: ImageRecord) => {
    try {
      await framebookApi.deleteImage(image.id)
      setImages((current) =>
        current.filter((candidate) => candidate.id !== image.id)
      )
      setStarredImages((current) =>
        current.filter((candidate) => candidate.id !== image.id)
      )
      setDetailImage((current) => (current?.id === image.id ? null : current))
      setPreviewImageId((current) => (current === image.id ? null : current))
      await loadTopics()
      toast.success("Image deleted", { description: image.title })
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

  const referenceImageFiles = (files: Array<File>) => {
    const validFiles: Array<File> = []

    for (const file of files) {
      if (!isReferenceImageFile(file)) {
        toast.error(referenceImageMessages.invalidType)
        continue
      }

      if (isReferenceImageTooLarge(file)) {
        toast.error(referenceImageMessages.tooLarge)
        continue
      }

      validFiles.push(file)
    }

    return validFiles
  }

  const addPromptReferenceImages = (files: Array<File>) => {
    const validFiles = referenceImageFiles(files)

    if (validFiles.length === 0) {
      return
    }

    setPromptReferenceImages((current) => {
      const availableSlots =
        referenceImageConfig.maxFiles -
        selectedTopicReferenceImages.length -
        current.length

      if (availableSlots <= 0) {
        toast.error(referenceImageMessages.tooMany)
        return current
      }

      if (validFiles.length > availableSlots) {
        toast.error(referenceImageMessages.tooMany)
      }

      const nextReferenceImages = validFiles
        .slice(0, availableSlots)
        .map((file) => ({
          id: createClientId(),
          file,
          previewUrl: createObjectUrl(file),
        }))

      return [...current, ...nextReferenceImages]
    })
  }

  const removePromptReferenceImage = (referenceImageId: string) => {
    setPromptReferenceImages((current) => {
      const removed = current.find(
        (referenceImage) => referenceImage.id === referenceImageId
      )

      if (removed) {
        revokeObjectUrl(removed.previewUrl)
      }

      return current.filter(
        (referenceImage) => referenceImage.id !== referenceImageId
      )
    })
  }

  const removeSelectedTopicReferenceImage = (referenceImageId: string) => {
    setExcludedTopicReferenceImageIds((current) => {
      if (current.has(referenceImageId)) {
        return current
      }

      const next = new Set(current)
      next.add(referenceImageId)
      return next
    })
  }

  const resetPromptReferences = () => {
    setExcludedTopicReferenceImageIds(new Set())
    setPromptReferenceImages((current) => {
      for (const referenceImage of current) {
        revokeObjectUrl(referenceImage.previewUrl)
      }

      return []
    })
  }

  const showReferenceImageError = (message: string) => {
    toast.error(message)
  }

  const generateCurrentPrompt = async () => {
    const submittedPromptValue =
      promptMode === "generation" ? generationPrompt : userPrompt

    if (!activeTopic || !submittedPromptValue.trim()) {
      return
    }

    const topicId = activeTopic.id
    const requestId = createClientId()
    const submittedUserPrompt = userPrompt.trim() || submittedPromptValue.trim()
    const submittedGenerationPrompt =
      promptMode === "generation" ? generationPrompt.trim() : ""
    const submittedTopicReferenceImageIds = selectedTopicReferenceImages.map(
      (referenceImage) => referenceImage.id
    )
    const submittedPromptReferenceFiles = promptReferenceImages.map(
      (referenceImage) => referenceImage.file
    )

    setError(null)
    setPendingGenerationRequests((current) => [
      ...current,
      {
        id: requestId,
        topicId,
        versionCount: selectedVersionCount,
      },
    ])
    setUserPrompt("")
    setGenerationPrompt("")
    setPromptMode("user")
    resetPromptReferences()
    toast(generationStartedToastMessage(selectedVersionCount), {
      id: generationToastId,
    })
    try {
      const response = await framebookApi.createGeneration(
        topicId,
        {
          rawPrompt: submittedUserPrompt,
          enhancedPrompt: submittedGenerationPrompt,
          aspectRatio: selectedAspectRatio,
          versionCount: selectedVersionCount,
          contextMode: researchContextEnabled ? "web" : "none",
          topicReferenceImageIds: submittedTopicReferenceImageIds,
        },
        submittedPromptReferenceFiles
      )
      const responseJobs = (
        response as { job: GenerationJob; jobs?: Array<GenerationJob> }
      ).jobs
      const createdJobs = responseJobs ?? [response.job]
      setJobs((currentJobs) => {
        const createdJobIds = new Set(
          createdJobs.map((generationJob) => generationJob.id)
        )
        const nextJobs = [
          ...currentJobs.filter(
            (generationJob) => !createdJobIds.has(generationJob.id)
          ),
          ...createdJobs,
        ]
        jobsRef.current = nextJobs
        return nextJobs
      })
    } catch (requestError) {
      toast.dismiss(generationToastId)
      toast.error("Image generation failed")
      setError(errorMessage(requestError))
    } finally {
      setPendingGenerationRequests((current) =>
        current.filter((request) => request.id !== requestId)
      )
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
          topics={topics}
          activeTopicId={activeTopicId}
          onNavigate={navigateTo}
          onSelectTopic={(topic) => openTopic(topic)}
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
                onDraftChange={(draft) => {
                  if (typeof window !== "undefined") {
                    saveNewTopicDraft(window.sessionStorage, draft)
                  }
                }}
                onReferenceImageError={showReferenceImageError}
                onAddReferenceImages={addTopicReferenceImages}
                onRemoveReferenceImage={removeTopicReferenceImage}
                onSubmit={submitTopic}
              />
            ) : null}

            {isLoadingActiveTopic ? <TopicWorkspaceSkeleton /> : null}

            {screen === "topic" && activeTopic ? (
              <TopicWorkspace
                topic={activeTopic}
                images={images}
                promptValue={promptValue}
                originalPromptValue={userPrompt}
                isOptimizedPrompt={promptMode === "generation"}
                selectedTopicReferenceImages={selectedTopicReferenceImages}
                promptReferenceImages={promptReferenceImages}
                selectedAspectRatio={selectedAspectRatio}
                selectedVersionCount={selectedVersionCount}
                researchContextEnabled={researchContextEnabled}
                creatingGenerationVersionCount={
                  pendingActiveTopicGenerationVersionCount
                }
                favoriteOnly={favoriteOnly}
                jobs={activeTopicGenerationJobs}
                isEnhancing={isEnhancing}
                isCreatingGeneration={
                  pendingActiveTopicGenerationVersionCount > 0
                }
                isLoadingImages={isLoadingImages}
                onBack={() => navigateTo("topics")}
                onEditTopic={() => startEditTopic(activeTopic)}
                onArchiveTopic={archiveActiveTopic}
                onPromptChange={updatePrompt}
                onAddPromptReferenceImages={addPromptReferenceImages}
                onRemovePromptReferenceImage={removePromptReferenceImage}
                onRemoveSelectedTopicReferenceImage={
                  removeSelectedTopicReferenceImage
                }
                onReferenceImageError={showReferenceImageError}
                onAspectRatioChange={setSelectedAspectRatio}
                onVersionCountChange={setSelectedVersionCount}
                onResearchContextChange={setResearchContextEnabled}
                onArchiveImage={archiveImage}
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
                onDeleteImage={deleteImage}
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
        onViewImageDetails={openPreviewImageDetail}
        onPreviousImage={
          previewImages.length > 1 ? () => cyclePreviewImage(-1) : undefined
        }
        onNextImage={
          previewImages.length > 1 ? () => cyclePreviewImage(1) : undefined
        }
      />
    </main>
  )
}
