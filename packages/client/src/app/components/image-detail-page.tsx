import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  FolderOpen,
  Share2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useHoverPreviewShortcut } from "../lib/preview-shortcut"
import { copyTextToClipboard } from "../lib/share"
import { formatDate, imageFileUrl, imageReferenceUrl } from "../lib/utils"
import { AppBreadcrumb } from "./app-breadcrumb"
import type { ImageRecord } from "@framebook/shared/contracts/framebook"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"

export function ImageDetailPage(props: {
  image: ImageRecord | null
  onBack: () => void
  onTopicsClick: () => void
  onRevealImage: (image: ImageRecord) => Promise<unknown>
  onPreviewImage: (image: ImageRecord) => void
  onDownloadImage: (image: ImageRecord) => Promise<void>
  onShareImage: (image: ImageRecord) => Promise<void>
}) {
  const image = props.image
  const [promptView, setPromptView] = useState<"default" | "full">("default")

  useEffect(() => {
    setPromptView("default")
  }, [image?.id])

  if (!image) {
    return <ImageDetailSkeleton />
  }
  const imageWithReferences = image as Omit<ImageRecord, "referenceImages"> & {
    referenceImages?: ImageRecord["referenceImages"]
  }
  const referenceImages = imageWithReferences.referenceImages ?? []
  const promptSource =
    image.enhancedPrompt.trim() === image.rawPrompt.trim()
      ? "Exact prompt"
      : "Enhanced prompt"
  const fullPrompt = image.imageGenerationPrompt || image.finalPrompt
  const promptValue = promptView === "full" ? fullPrompt : image.finalPrompt

  return (
    <div className="mx-auto flex flex-col gap-5">
      <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-border/60 bg-background/92 pb-4 backdrop-blur-sm">
        <div className="min-w-0">
          <AppBreadcrumb
            items={[
              { label: "Topics", onClick: props.onTopicsClick },
              { label: image.topicSnapshot.name, onClick: props.onBack },
              { label: image.title },
            ]}
          />
        </div>
      </header>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={props.onBack}
            >
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => props.onPreviewImage(image)}
              >
                <Eye data-icon="inline-start" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void props.onDownloadImage(image)}
              >
                <Download data-icon="inline-start" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void props.onRevealImage(image)}
              >
                <FolderOpen data-icon="inline-start" />
                Finder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void props.onShareImage(image)}
              >
                <Share2 data-icon="inline-start" />
                Share
              </Button>
            </div>
          </div>
          <DetailPreviewImage
            image={image}
            onPreviewImage={props.onPreviewImage}
          />
        </div>

        <aside className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          {referenceImages.length > 0 ? (
            <ReferenceImages image={image} referenceImages={referenceImages} />
          ) : null}
          <PromptBlock
            label="Image generation prompt"
            value={promptValue}
            view={promptView}
            onViewChange={setPromptView}
            hasFullPrompt={fullPrompt !== image.finalPrompt}
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <MetaItem label="Topic" value={image.topicSnapshot.name} />
            {image.creativeMode.id ? (
              <MetaItem label="Creative mode" value={image.creativeMode.name} />
            ) : null}
            <MetaItem label="Prompt source" value={promptSource} />
            <MetaItem label="Aspect ratio" value={image.aspectRatio} />
            <MetaItem label="Created" value={formatDate(image.createdAt)} />
            <MetaItem label="File" value={image.fileName} />
            <MetaItem label="MIME" value={image.mimeType} />
          </dl>
        </aside>
      </section>
    </div>
  )
}

function ReferenceImages({
  image,
  referenceImages,
}: {
  image: ImageRecord
  referenceImages: ImageRecord["referenceImages"]
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto">
        {referenceImages.map((referenceImage) => (
          <a
            key={referenceImage.id}
            href={imageReferenceUrl(image.id, referenceImage.id)}
            target="_blank"
            rel="noreferrer"
            className="group relative size-20 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted transition hover:border-ring/30"
            title={referenceImage.originalName}
          >
            <img
              src={imageReferenceUrl(image.id, referenceImage.id)}
              alt={referenceImage.originalName}
              className="size-full object-cover transition group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
              width={referenceImage.width}
              height={referenceImage.height}
            />
          </a>
        ))}
      </div>
    </div>
  )
}

function DetailPreviewImage(props: {
  image: ImageRecord
  onPreviewImage: (image: ImageRecord) => void
}) {
  const previewShortcut = useHoverPreviewShortcut(() =>
    props.onPreviewImage(props.image)
  )

  return (
    <button
      type="button"
      className="overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm transition hover:border-ring/30"
      onClick={() => props.onPreviewImage(props.image)}
      {...previewShortcut}
    >
      <img
        src={imageFileUrl(props.image.id)}
        alt={props.image.title}
        className="max-h-160 w-full object-contain"
      />
    </button>
  )
}

function PromptBlock({
  label,
  value,
  view,
  onViewChange,
  hasFullPrompt,
}: {
  label: string
  value: string
  view: "default" | "full"
  onViewChange: (view: "default" | "full") => void
  hasFullPrompt: boolean
}) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {hasFullPrompt ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={view === "default" ? "default" : "outline"}
              size="xs"
              onClick={() => onViewChange("default")}
            >
              Default
            </Button>
            <Button
              type="button"
              variant={view === "full" ? "default" : "outline"}
              size="xs"
              onClick={() => onViewChange("full")}
            >
              Full
            </Button>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="absolute top-2 right-2 bg-background/80"
          aria-label="Copy"
          title="Copy"
          onClick={async () => {
            const copied = await copyTextToClipboard(value)
            if (copied) toast.success("Prompt copied")
            else toast.error("Could not copy")
          }}
        >
          <Copy className="size-3" />
        </Button>
        <pre className="overflow-x-auto rounded-xl border border-border/40 bg-muted/30 p-4 pr-12 font-mono text-[13px] leading-6 whitespace-pre-wrap text-foreground/80">
          {value}
        </pre>
      </div>
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

function ImageDetailSkeleton() {
  return (
    <div
      className="mx-auto flex flex-col gap-5"
      aria-label="Loading image detail"
    >
      {/* Breadcrumb */}
      <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-border/60 bg-background/92 pb-4 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="size-1 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-1 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </header>

      <section className="flex flex-col gap-5">
        {/* Toolbar row */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <div className="flex flex-wrap justify-end gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>

          {/* Image */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
            <Skeleton className="h-105 w-full rounded-none" />
          </div>
        </div>

        {/* Metadata card */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          {/* Prompt block 1 */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          {/* Prompt block 2 */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {["a", "b", "c", "d", "e", "f"].map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
