import {
  Download,
  Eye,
  FolderOpen,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
} from "lucide-react"
import { cn } from "@shared/lib/utils"
import { formatDate, imageFileUrl, modeLabel } from "../lib/utils"
import type { ImageRecord } from "@framebook/shared/contracts/framebook"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Separator } from "@/shared/ui/separator"
import { Skeleton } from "@/shared/ui/skeleton"

export function ImageDetailPage(props: {
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
      <header className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            onClick={props.onBack}
          >
            Images <span className="opacity-40">/</span>{" "}
            {image.topicSnapshot.name}
          </button>
          <h1 className="line-clamp-2 font-heading text-2xl font-bold tracking-tight">
            {image.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{image.aspectRatio}</Badge>
            <Badge variant={image.favorite ? "default" : "outline"}>
              {image.favorite ? "Starred" : "Not starred"}
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
          <Button
            variant="outline"
            onClick={() => props.onToggleFavorite(image)}
          >
            <Star
              data-icon="inline-start"
              className={cn(image.favorite ? "fill-ring text-ring" : "")}
            />
            Starred
          </Button>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm transition hover:border-ring/30"
            onClick={() => props.onPreviewImage(image)}
          >
            <img
              src={imageFileUrl(image.id)}
              alt={image.title}
              className="max-h-160 w-full object-contain"
            />
          </button>
          <div className="flex flex-wrap gap-2">
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

        <aside className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
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
      <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
        {label}
      </div>
      <p className="rounded-xl border border-border/40 bg-muted/30 p-3 text-sm leading-relaxed text-foreground/80">
        {value}
      </p>
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
