import { Copy, Download, Eye, FolderOpen, Share2 } from "lucide-react"
import { toast } from "sonner"
import { copyTextToClipboard } from "../lib/share"
import { formatDate, imageFileUrl, modeLabel } from "../lib/utils"
import { AppBreadcrumb } from "./app-breadcrumb"
import type { ImageRecord } from "@framebook/shared/contracts/framebook"
import { Badge } from "@/shared/ui/badge"
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

  if (!image) {
    return (
      <div
        className="mx-auto flex max-w-5xl flex-col gap-5"
        aria-label="Loading image detail"
      >
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-105 w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-border/60 pb-4">
        <div className="min-w-0">
          <AppBreadcrumb
            items={[
              { label: "Topics", onClick: props.onTopicsClick },
              { label: image.topicSnapshot.name, onClick: props.onBack },
              { label: image.title },
            ]}
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{image.aspectRatio}</Badge>
            <Badge variant={image.favorite ? "default" : "outline"}>
              {image.favorite ? "Starred" : "Not starred"}
            </Badge>
            <Badge variant="outline">{modeLabel(image.enhancerMode)}</Badge>
            <Badge variant="outline">{formatDate(image.createdAt)}</Badge>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
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
        </div>

        <aside className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <PromptBlock
            label="Image generation prompt"
            value={image.finalPrompt}
          />
          <PromptBlock label="User prompt" value={image.rawPrompt} />
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
      <div className="mb-1.5 text-sm font-medium text-muted-foreground">
        {label}
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
