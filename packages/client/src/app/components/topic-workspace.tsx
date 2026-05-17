import {
  Archive,
  Eye,
  ImageIcon,
  ImagePlus,
  Loader2,
  Pencil,
  Search,
  Send,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { useDropzone } from "react-dropzone"
import { cn } from "@shared/lib/utils"
import { aspectRatioOptions, generationVersionOptions } from "../lib/constants"
import { activeGenerationJobCount } from "../lib/generation"
import {
  referenceImageConfig,
  referenceImageDropErrorMessage,
  referenceImageDropzoneAccept,
} from "../lib/reference-images"
import {
  formatDate,
  imageFileUrl,
  imageGridSizes,
  imageSrcSet,
  imageVariantUrl,
  topicReferenceImageUrl,
} from "../lib/utils"
import { useHoverPreviewShortcut } from "../lib/preview-shortcut"
import { AppBreadcrumb } from "./app-breadcrumb"
import { ConfirmationDialog } from "./confirmation-dialog"
import { ReferenceImageDropOverlay } from "./reference-image-drop-overlay"
import type { ReactNode } from "react"
import type { DropzoneState } from "react-dropzone"
import type {
  AspectRatio,
  GenerationJob,
  GenerationVersionCount,
  ImageRecord,
  ReferenceImage,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"
import type { PromptReferenceImageAttachment } from "../lib/types"
import { Button } from "@/shared/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Skeleton } from "@/shared/ui/skeleton"
import { Textarea } from "@/shared/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip"

export function TopicWorkspace(props: {
  topic: TopicSummary
  images: Array<ImageRecord>
  promptValue: string
  originalPromptValue?: string
  isOptimizedPrompt?: boolean
  selectedTopicReferenceImages: Array<ReferenceImage>
  promptReferenceImages: Array<PromptReferenceImageAttachment>
  selectedAspectRatio: AspectRatio
  selectedVersionCount?: GenerationVersionCount
  creatingGenerationVersionCount?: number
  researchContextEnabled?: boolean
  favoriteOnly: boolean
  job?: GenerationJob | null
  jobs?: Array<GenerationJob>
  isEnhancing: boolean
  isCreatingGeneration: boolean
  isLoadingImages: boolean
  onBack: () => void
  onEditTopic: () => void
  onArchiveTopic: () => void
  onPromptChange: (value: string) => void
  onAddPromptReferenceImages: (files: Array<File>) => void
  onRemovePromptReferenceImage: (referenceImageId: string) => void
  onRemoveSelectedTopicReferenceImage: (referenceImageId: string) => void
  onReferenceImageError: (message: string) => void
  onAspectRatioChange: (value: AspectRatio) => void
  onVersionCountChange?: (value: GenerationVersionCount) => void
  onResearchContextChange?: (value: boolean) => void
  onEnhancePrompt: () => void
  onGenerate: () => void
  onToggleFavorite: (image: ImageRecord) => void
  onArchiveImage?: (image: ImageRecord) => Promise<void>
  onRevealImage: (image: ImageRecord) => Promise<unknown>
  onPreviewImage: (image: ImageRecord) => void
  onViewImageDetails: (image: ImageRecord) => void
  onDownloadImage: (image: ImageRecord) => Promise<void>
  onFavoriteFilterChange: (value: boolean) => void
}) {
  const canGenerate = Boolean(props.promptValue.trim())
  const activeJobCount = activeGenerationJobCount(
    props.jobs ?? (props.job ? [props.job] : [])
  )
  const pendingPlaceholderCount = props.isCreatingGeneration
    ? (props.creatingGenerationVersionCount ?? props.selectedVersionCount ?? 1)
    : 0
  const generatingPlaceholderCount = activeJobCount + pendingPlaceholderCount
  const isGenerating = generatingPlaceholderCount > 0
  const selectedReferenceCount =
    props.selectedTopicReferenceImages.length +
    props.promptReferenceImages.length
  const availableReferenceSlots =
    referenceImageConfig.maxFiles - selectedReferenceCount
  const referenceImageDropzone = useDropzone({
    accept: referenceImageDropzoneAccept,
    disabled: isGenerating || availableReferenceSlots <= 0,
    maxFiles: Math.max(1, availableReferenceSlots),
    maxSize: referenceImageConfig.maxBytes,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: props.onAddPromptReferenceImages,
    onDropRejected: (rejections) => {
      props.onReferenceImageError(referenceImageDropErrorMessage(rejections))
    },
  })
  const isReferenceImageDragActive =
    referenceImageDropzone.isDragActive ||
    isDropzoneGloballyActive(referenceImageDropzone)

  return (
    <div
      {...referenceImageDropzone.getRootProps({
        "aria-label": "Topic workspace image dropzone",
        "data-testid": "topic-workspace-dropzone",
        className:
          "relative flex h-[calc(100svh-2rem)] w-full max-w-none flex-col gap-2",
      })}
    >
      <input {...referenceImageDropzone.getInputProps()} />
      {isReferenceImageDragActive ? (
        <ReferenceImageDropOverlay
          isRejecting={referenceImageDropzone.isDragReject}
          body="Drop it anywhere to add it to this prompt."
        />
      ) : null}
      <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border/60 bg-background/92 pb-2 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <AppBreadcrumb
          items={[
            { label: "Topics", onClick: props.onBack },
            { label: props.topic.name },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border border-border"
            onClick={props.onEditTopic}
          >
            <Pencil className="size-3.5" data-icon="inline-start" />
            Edit Topic
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="border border-destructive/25"
            onClick={props.onArchiveTopic}
          >
            <Archive className="size-3.5" data-icon="inline-start" />
            Archive
          </Button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        <GalleryCanvas
          images={props.images}
          isLoading={props.isLoadingImages}
          isGenerating={isGenerating}
          generatingPlaceholderCount={generatingPlaceholderCount}
          favoriteOnly={props.favoriteOnly}
          onFavoriteFilterChange={props.onFavoriteFilterChange}
          onToggleFavorite={props.onToggleFavorite}
          onArchiveImage={props.onArchiveImage}
          onPreviewImage={props.onPreviewImage}
          onViewImageDetails={props.onViewImageDetails}
        />

        <div className="flex flex-col gap-2">
          <PromptComposer
            promptValue={props.promptValue}
            originalPromptValue={props.originalPromptValue}
            isOptimizedPrompt={props.isOptimizedPrompt}
            topicId={props.topic.id}
            selectedTopicReferenceImages={props.selectedTopicReferenceImages}
            promptReferenceImages={props.promptReferenceImages}
            selectedAspectRatio={props.selectedAspectRatio}
            selectedVersionCount={props.selectedVersionCount ?? 1}
            researchContextEnabled={props.researchContextEnabled ?? false}
            isEnhancing={props.isEnhancing}
            isSubmittingGeneration={props.isCreatingGeneration}
            canGenerate={canGenerate}
            availableReferenceSlots={availableReferenceSlots}
            referenceImageDropzone={referenceImageDropzone}
            onPromptChange={props.onPromptChange}
            onRemovePromptReferenceImage={props.onRemovePromptReferenceImage}
            onRemoveSelectedTopicReferenceImage={
              props.onRemoveSelectedTopicReferenceImage
            }
            onAspectRatioChange={props.onAspectRatioChange}
            onVersionCountChange={props.onVersionCountChange}
            onResearchContextChange={props.onResearchContextChange}
            onEnhancePrompt={props.onEnhancePrompt}
            onGenerate={props.onGenerate}
          />
        </div>
      </section>
    </div>
  )
}

export function TopicWorkspaceSkeleton() {
  return (
    <div
      className="flex h-[calc(100svh-2rem)] w-full max-w-none flex-col gap-2"
      aria-label="Loading topic workspace"
    >
      <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border/60 bg-background/92 pb-2 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="size-1 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden px-2 pt-1.5 pb-2">
          <GallerySkeleton />
        </div>

        <div className="flex flex-col gap-2">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 rounded-xl" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-32 rounded-lg" />
                  <Skeleton className="h-9 w-40 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-lg" />
                  <Skeleton className="h-9 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function PromptComposer(props: {
  promptValue: string
  originalPromptValue?: string
  isOptimizedPrompt?: boolean
  topicId: string
  selectedTopicReferenceImages: Array<ReferenceImage>
  promptReferenceImages: Array<PromptReferenceImageAttachment>
  selectedAspectRatio: AspectRatio
  selectedVersionCount: GenerationVersionCount
  researchContextEnabled: boolean
  isEnhancing: boolean
  isSubmittingGeneration: boolean
  canGenerate: boolean
  availableReferenceSlots: number
  referenceImageDropzone: DropzoneState
  onPromptChange: (value: string) => void
  onRemovePromptReferenceImage: (referenceImageId: string) => void
  onRemoveSelectedTopicReferenceImage: (referenceImageId: string) => void
  onAspectRatioChange: (value: AspectRatio) => void
  onVersionCountChange?: (value: GenerationVersionCount) => void
  onResearchContextChange?: (value: boolean) => void
  onEnhancePrompt: () => void
  onGenerate: () => void
}) {
  const hasReferenceImages =
    props.selectedTopicReferenceImages.length > 0 ||
    props.promptReferenceImages.length > 0
  const showOriginalPrompt =
    props.isOptimizedPrompt && Boolean(props.originalPromptValue?.trim())

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm transition-colors",
        props.referenceImageDropzone.isDragActive
          ? "border-ring/40 bg-accent/40"
          : ""
      )}
    >
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="raw-prompt">
          Prompt
        </label>
        <div className="relative">
          <Textarea
            id="raw-prompt"
            value={props.promptValue}
            onChange={(event) => props.onPromptChange(event.target.value)}
            rows={3}
            className={cn(
              "min-h-18 resize-none border-border/50 bg-background/60 pr-44 pb-13 text-sm",
              hasReferenceImages ? "min-h-36 pb-24" : ""
            )}
            placeholder="Describe the image you want to create..."
          />
          {hasReferenceImages ? (
            <ReferenceImageStrip
              topicId={props.topicId}
              selectedTopicReferenceImages={props.selectedTopicReferenceImages}
              promptReferenceImages={props.promptReferenceImages}
              onRemovePromptReferenceImage={props.onRemovePromptReferenceImage}
              onRemoveSelectedTopicReferenceImage={
                props.onRemoveSelectedTopicReferenceImage
              }
            />
          ) : null}
          <TooltipProvider>
            <TooltipIconButton
              tooltip="Attach reference images"
              className="absolute right-24 bottom-3"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Attach reference images"
                disabled={
                  props.isSubmittingGeneration ||
                  props.availableReferenceSlots <= 0
                }
                onClick={props.referenceImageDropzone.open}
              >
                <ImagePlus data-icon="inline-start" />
              </Button>
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Research context"
              className="absolute right-14 bottom-3"
            >
              <Button
                type="button"
                variant={props.researchContextEnabled ? "default" : "outline"}
                size="sm"
                aria-label="Research context"
                aria-pressed={props.researchContextEnabled}
                onClick={() =>
                  props.onResearchContextChange?.(!props.researchContextEnabled)
                }
                className={cn(
                  props.researchContextEnabled
                    ? "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/88 hover:text-primary-foreground"
                    : ""
                )}
              >
                <Search data-icon="inline-start" />
              </Button>
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="AI enhance"
              className="absolute right-3 bottom-3"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Enhance prompt"
                disabled={!props.canGenerate || props.isEnhancing}
                onClick={props.onEnhancePrompt}
              >
                {props.isEnhancing ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
              </Button>
            </TooltipIconButton>
          </TooltipProvider>
        </div>
        {showOriginalPrompt ? (
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
            <div className="font-medium text-muted-foreground">
              Original prompt
            </div>
            <p className="mt-1 line-clamp-3 text-foreground/75">
              {props.originalPromptValue}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={props.selectedAspectRatio}
            onValueChange={(value) =>
              props.onAspectRatioChange(value as AspectRatio)
            }
          >
            <SelectTrigger
              className="w-full text-xs sm:w-40"
              aria-label="Aspect ratio"
            >
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

          <Select
            value={String(props.selectedVersionCount)}
            onValueChange={(value) =>
              props.onVersionCountChange?.(
                Number(value) as GenerationVersionCount
              )
            }
          >
            <SelectTrigger
              className="w-full text-xs sm:w-24"
              aria-label="Versions"
            >
              <SelectValue placeholder="Versions" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {generationVersionOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!props.canGenerate || props.isSubmittingGeneration}
            onClick={props.onGenerate}
            className="min-w-24"
          >
            {props.isSubmittingGeneration ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Generate
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReferenceImageStrip(props: {
  topicId: string
  selectedTopicReferenceImages: Array<ReferenceImage>
  promptReferenceImages: Array<PromptReferenceImageAttachment>
  onRemovePromptReferenceImage: (referenceImageId: string) => void
  onRemoveSelectedTopicReferenceImage: (referenceImageId: string) => void
}) {
  return (
    <div className="absolute right-36 bottom-3 left-3">
      <div className="flex gap-2 overflow-x-auto">
        {props.selectedTopicReferenceImages.map((referenceImage) => (
          <ReferenceImageChip
            key={referenceImage.id}
            src={topicReferenceImageUrl(props.topicId, referenceImage.id)}
            name={referenceImage.originalName}
            label="Topic"
            onRemove={() =>
              props.onRemoveSelectedTopicReferenceImage(referenceImage.id)
            }
          />
        ))}
        {props.promptReferenceImages.map((referenceImage) => (
          <ReferenceImageChip
            key={referenceImage.id}
            src={referenceImage.previewUrl}
            name={referenceImage.file.name}
            label="Prompt"
            onRemove={() =>
              props.onRemovePromptReferenceImage(referenceImage.id)
            }
          />
        ))}
      </div>
    </div>
  )
}

function ReferenceImageChip(props: {
  src: string
  name: string
  label: string
  onRemove: () => void
}) {
  return (
    <div
      className="group relative size-18 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted"
      title={props.name}
    >
      <a
        href={props.src}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${props.name}`}
      >
        <img
          src={props.src}
          alt={props.name}
          className="size-full object-cover"
        />
      </a>
      <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium tracking-wide text-white uppercase">
        {props.label}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        className="absolute top-1 right-1"
        aria-label={`Remove ${props.name}`}
        onClick={props.onRemove}
      >
        <X data-icon="inline-start" />
      </Button>
    </div>
  )
}

function TooltipIconButton(props: {
  tooltip: string
  className: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", props.className)}>
          {props.children}
        </span>
      </TooltipTrigger>
      <TooltipContent align="end">
        <p>{props.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function isDropzoneGloballyActive(dropzone: DropzoneState) {
  return dropzone.isDragGlobal
}

function GalleryCanvas(props: {
  images: Array<ImageRecord>
  isLoading: boolean
  isGenerating: boolean
  generatingPlaceholderCount: number
  favoriteOnly: boolean
  onFavoriteFilterChange: (value: boolean) => void
  onToggleFavorite: (image: ImageRecord) => void
  onArchiveImage?: (image: ImageRecord) => Promise<void>
  onPreviewImage: (image: ImageRecord) => void
  onViewImageDetails: (image: ImageRecord) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1.5 pb-2">
        {props.isLoading ? <GallerySkeleton /> : null}

        {!props.isLoading &&
        props.images.length === 0 &&
        !props.isGenerating ? (
          <div className="relative grid min-h-full place-items-center overflow-hidden rounded-xl border border-dashed border-border/60 text-center">
            <div className="pointer-events-none absolute inset-0 framer-grid opacity-20" />
            <div className="relative py-10">
              <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground">
                <ImageIcon className="size-4" />
              </div>
              <div className="text-sm font-semibold">No images yet</div>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Use the prompt box below to generate images for this topic.
              </p>
            </div>
          </div>
        ) : null}

        {!props.isLoading && (props.images.length > 0 || props.isGenerating) ? (
          <div className="columns-1 gap-4 [column-fill:balance] sm:columns-2 2xl:columns-3">
            {props.isGenerating
              ? Array.from(
                  { length: Math.max(1, props.generatingPlaceholderCount) },
                  (_, index) => (
                    <GeneratingImageCard key={`generating-${index}`} />
                  )
                )
              : null}
            {props.images.map((image, index) => {
              const highPriorityCount = props.isGenerating ? 2 : 3

              return (
                <GalleryImageCard
                  key={image.id}
                  image={image}
                  fetchPriority={index < highPriorityCount ? "high" : undefined}
                  onPreviewImage={props.onPreviewImage}
                  onToggleFavorite={props.onToggleFavorite}
                  onArchiveImage={props.onArchiveImage}
                  onViewImageDetails={props.onViewImageDetails}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function GalleryImageCard(props: {
  image: ImageRecord
  fetchPriority: "high" | undefined
  onPreviewImage: (image: ImageRecord) => void
  onToggleFavorite: (image: ImageRecord) => void
  onArchiveImage?: (image: ImageRecord) => Promise<void>
  onViewImageDetails: (image: ImageRecord) => void
}) {
  const srcSet = imageSrcSet(props.image)
  const previewShortcut = useHoverPreviewShortcut(() =>
    props.onPreviewImage(props.image)
  )

  return (
    <article
      className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm transition-all duration-200 hover:border-ring/30 hover:shadow-md hover:shadow-black/15 dark:hover:border-white/12 dark:hover:shadow-black/30"
      {...previewShortcut}
    >
      <button
        type="button"
        className="block w-full bg-muted text-left"
        onClick={() => {
          props.onViewImageDetails(props.image)
        }}
        aria-label={`View details for ${props.image.title}`}
      >
        <img
          src={
            srcSet
              ? imageVariantUrl(props.image.id, 480)
              : imageFileUrl(props.image.id)
          }
          srcSet={srcSet}
          sizes={imageGridSizes("topic")}
          alt={props.image.title}
          width={props.image.width}
          height={props.image.height}
          loading="lazy"
          decoding="async"
          fetchPriority={props.fetchPriority}
          className="block h-auto w-full object-contain"
        />
      </button>

      <div className="border-t border-border/50 bg-card/86 p-3">
        <div className="line-clamp-1 text-xs font-semibold text-foreground">
          {props.image.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{props.image.aspectRatio}</span>
          <span>·</span>
          <span>{formatDate(props.image.createdAt)}</span>
        </div>
      </div>

      {props.onArchiveImage ? (
        <div className="absolute top-1.5 left-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <ConfirmationDialog
            title="Archive image?"
            description={`Archive “${props.image.title}”? You can restore it later from Settings.`}
            confirmLabel="Archive"
            onConfirm={() => props.onArchiveImage?.(props.image)}
            trigger={
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label={`Archive ${props.image.title}`}
                title="Archive"
              >
                <Archive className="text-destructive" />
              </Button>
            }
          />
        </div>
      ) : null}

      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          onClick={() => props.onPreviewImage(props.image)}
          aria-label={`Preview ${props.image.title}`}
          title="Preview"
        >
          <Eye />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          onClick={() => props.onToggleFavorite(props.image)}
          aria-label={
            props.image.favorite ? "Remove favorite" : "Mark favorite"
          }
          title={props.image.favorite ? "Remove favorite" : "Mark favorite"}
        >
          <Star
            className={cn(props.image.favorite ? "fill-ring text-ring" : "")}
          />
        </Button>
      </div>
    </article>
  )
}

function GeneratingImageCard() {
  return (
    <article
      className="generating-image-skeleton relative mb-4 min-h-80 break-inside-avoid overflow-hidden rounded-2xl border border-ring/20 bg-muted shadow-sm"
      aria-label="Generating image"
    >
      <div className="absolute inset-0 framer-grid opacity-10" />
      <Skeleton className="size-full rounded-none opacity-60" />
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/45 to-transparent p-3 pt-10">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Loader2 className="size-3.5 animate-spin text-ring" />
          Generating image
        </div>
      </div>
    </article>
  )
}

function GallerySkeleton() {
  return (
    <div
      className="columns-1 gap-4 sm:columns-2 2xl:columns-3"
      aria-label="Loading gallery"
    >
      {["first", "second", "third", "fourth", "fifth", "sixth"].map((key) => (
        <div
          key={key}
          className="mb-4 h-80 break-inside-avoid overflow-hidden rounded-2xl border border-border/50 bg-muted odd:h-96"
        >
          <Skeleton className="size-full rounded-none" />
        </div>
      ))}
    </div>
  )
}
