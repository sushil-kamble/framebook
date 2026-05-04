import {
  Archive,
  Check,
  ImageIcon,
  Info,
  Loader2,
  Pencil,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { cn } from "@shared/lib/utils"
import { aspectRatioOptions, resolutionPresetOptions } from "../lib/constants"
import { formatDate, imageFileUrl } from "../lib/utils"
import { IconButton } from "./icon-button"
import type {
  AspectRatio,
  GenerationJob,
  ImageRecord,
  ResolutionPreset,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
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

export function TopicWorkspace(props: {
  topic: TopicSummary
  images: Array<ImageRecord>
  rawPrompt: string
  enhancedPrompt: string
  selectedAspectRatio: AspectRatio
  selectedResolutionPreset: ResolutionPreset
  favoriteOnly: boolean
  job: GenerationJob | null
  isEnhancing: boolean
  isLoadingImages: boolean
  onBack: () => void
  onEditTopic: () => void
  onArchiveTopic: () => void
  onRawPromptChange: (value: string) => void
  onAspectRatioChange: (value: AspectRatio) => void
  onResolutionPresetChange: (value: ResolutionPreset) => void
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
    <div className="flex h-[calc(100svh-2.5rem)] w-full max-w-none flex-col gap-3">
      <header className="flex flex-col gap-2.5 border-b border-border/60 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              className="transition hover:text-foreground"
              onClick={props.onBack}
            >
              Topics
            </button>
            <span className="opacity-40">/</span>
            <span className="text-foreground/70">{props.topic.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <IconButton label="Topic Settings" onClick={props.onEditTopic}>
            <Pencil className="size-3.5" />
          </IconButton>
          <IconButton label="Archive Topic" onClick={props.onArchiveTopic}>
            <Archive className="size-3.5" />
          </IconButton>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
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

        <div className="flex flex-col gap-2.5">
          <GenerationStatus job={props.job} />
          <PromptComposer
            rawPrompt={props.rawPrompt}
            enhancedPrompt={props.enhancedPrompt}
            selectedAspectRatio={props.selectedAspectRatio}
            selectedResolutionPreset={props.selectedResolutionPreset}
            isEnhancing={props.isEnhancing}
            isGenerating={isGenerating}
            canGenerate={canGenerate}
            onRawPromptChange={props.onRawPromptChange}
            onAspectRatioChange={props.onAspectRatioChange}
            onResolutionPresetChange={props.onResolutionPresetChange}
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
      className="flex h-[calc(100svh-2.5rem)] w-full max-w-none flex-col gap-3"
      aria-label="Loading topic workspace"
    >
      <header className="flex flex-col gap-2.5 border-b border-border/60 pb-3 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="min-h-0 flex-1 overflow-hidden px-3 pt-2 pb-3">
          <GallerySkeleton />
        </div>

        <Separator />

        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-11 rounded-xl" />
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3.5 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-2.5">
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
  rawPrompt: string
  enhancedPrompt: string
  selectedAspectRatio: AspectRatio
  selectedResolutionPreset: ResolutionPreset
  isEnhancing: boolean
  isGenerating: boolean
  canGenerate: boolean
  onRawPromptChange: (value: string) => void
  onAspectRatioChange: (value: AspectRatio) => void
  onResolutionPresetChange: (value: ResolutionPreset) => void
  onEnhancePrompt: () => void
  onGenerate: () => void
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-3.5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-2.5">
        <label className="sr-only" htmlFor="raw-prompt">
          Prompt
        </label>
        {props.enhancedPrompt ? (
          <div className="px-0.5 text-xs text-muted-foreground/60">
            <Badge variant="secondary" className="text-[10px]">
              Enhanced
            </Badge>
          </div>
        ) : null}
        <div className="relative">
          <Textarea
            id="raw-prompt"
            value={props.rawPrompt}
            onChange={(event) => props.onRawPromptChange(event.target.value)}
            rows={3}
            className="min-h-20 resize-none border-border/50 bg-background/60 pr-28 pb-14 text-sm"
            placeholder="Describe the image you want to create..."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              !props.canGenerate || props.isEnhancing || props.isGenerating
            }
            onClick={props.onEnhancePrompt}
            className="absolute right-3 bottom-3"
          >
            {props.isEnhancing ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            Enhance
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            value={props.selectedResolutionPreset}
            onValueChange={(value) =>
              props.onResolutionPresetChange(value as ResolutionPreset)
            }
          >
            <SelectTrigger
              className="w-full text-xs sm:w-52"
              aria-label="Resolution"
            >
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {resolutionPresetOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
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
            disabled={!props.canGenerate || props.isGenerating}
            onClick={props.onGenerate}
            className="min-w-24"
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

function GenerationStatus({ job }: { job: GenerationJob | null }) {
  if (!job) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-xs text-muted-foreground/60">
        Generation status appears here after you create an image.
      </div>
    )
  }

  const running = job.status === "queued" || job.status === "running"

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border px-4 py-3 shadow-sm transition-all",
        running
          ? "border-ring/20 bg-ring/10"
          : job.status === "succeeded"
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-destructive/20 bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            running
              ? "bg-ring/15"
              : job.status === "succeeded"
                ? "bg-emerald-500/15"
                : "bg-destructive/15"
          )}
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin text-ring" />
          ) : job.status === "succeeded" ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <X className="size-3.5 text-destructive" />
          )}
        </div>
        <div>
          <div className="text-sm font-semibold">
            {running
              ? "Generating via local server..."
              : job.status === "succeeded"
                ? "Generation complete"
                : "Generation failed"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-3">
        {props.isLoading ? <GallerySkeleton /> : null}

        {!props.isLoading && props.images.length === 0 ? (
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

        {!props.isLoading && props.images.length > 0 ? (
          <div className="grid auto-rows-[190px] grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {props.images.map((image) => (
              <article
                key={image.id}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm transition-all duration-200 hover:border-white/12 hover:shadow-md hover:shadow-black/30"
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
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-3 pt-10">
                  <div className="line-clamp-1 text-xs font-semibold text-white">
                    {image.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/55">
                    <span>{image.aspectRatio}</span>
                    <span>·</span>
                    <span>{formatDate(image.createdAt)}</span>
                  </div>
                </div>

                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
                    aria-label={
                      image.favorite ? "Remove favorite" : "Mark favorite"
                    }
                    title={image.favorite ? "Remove favorite" : "Mark favorite"}
                  >
                    <Star
                      className={cn(
                        image.favorite ? "fill-ring text-ring" : ""
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
    <div
      className="grid auto-rows-[190px] grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4"
      aria-label="Loading gallery"
    >
      {["first", "second", "third", "fourth", "fifth", "sixth"].map((key) => (
        <div
          key={key}
          className="overflow-hidden rounded-2xl border border-border/50 bg-muted"
        >
          <Skeleton className="size-full rounded-none" />
        </div>
      ))}
    </div>
  )
}
