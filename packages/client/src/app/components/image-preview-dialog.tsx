import { useEffect, useState } from "react"
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Info,
  Share2,
  X,
} from "lucide-react"
import { cn } from "@shared/lib/utils"
import {
  formatDate,
  formatViewerTimestamp,
  imageFileUrl,
  imageResolutionLabel,
} from "../lib/utils"
import { ConfirmationDialog } from "./confirmation-dialog"
import type { ReactNode } from "react"
import type { ImageRecord } from "@framebook/shared/contracts/framebook"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog"

export function ImagePreviewDialog(props: {
  image: ImageRecord | null
  onClose: () => void
  onDownloadImage: (image: ImageRecord) => Promise<void>
  onRevealImage: (image: ImageRecord) => Promise<unknown>
  onShareImage: (image: ImageRecord) => Promise<void>
  onArchiveImage: (image: ImageRecord) => Promise<void>
  onViewImageDetails: (image: ImageRecord) => void
  onPreviousImage?: () => void
  onNextImage?: () => void
}) {
  const image = props.image
  const { onClose, onNextImage, onPreviousImage } = props
  const [imageResolution, setImageResolution] = useState<{
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    setImageResolution(null)
  }, [image?.id])

  useEffect(() => {
    if (!image) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.key.toLowerCase() === "v") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === "ArrowLeft" && onPreviousImage) {
        event.preventDefault()
        onPreviousImage()
        return
      }

      if (event.key === "ArrowRight" && onNextImage) {
        event.preventDefault()
        onNextImage()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [image, onClose, onNextImage, onPreviousImage])

  if (!image) {
    return null
  }

  return (
    <Dialog
      open={Boolean(image)}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
    >
      <DialogContent
        className="aspect-video max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none gap-0 overflow-hidden rounded-lg border border-white/10 bg-black p-0 text-white shadow-none sm:w-[min(96vw,1560px)] sm:max-w-[min(96vw,1560px)]"
        data-framebook-preview-dialog="true"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{image.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {image.aspectRatio} image generated {formatDate(image.createdAt)}
        </DialogDescription>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <img
            src={imageFileUrl(image.id)}
            alt={image.title}
            className="size-full object-contain"
            onLoad={(event) => {
              const nextWidth = event.currentTarget.naturalWidth
              const nextHeight = event.currentTarget.naturalHeight

              if (nextWidth > 0 && nextHeight > 0) {
                setImageResolution({ width: nextWidth, height: nextHeight })
              }
            }}
          />
          {onPreviousImage ? (
            <ViewerNavigationButton
              label="Previous image"
              className="left-3 sm:left-4"
              onClick={onPreviousImage}
            >
              <ChevronLeft />
            </ViewerNavigationButton>
          ) : null}
          {onNextImage ? (
            <ViewerNavigationButton
              label="Next image"
              className="right-3 sm:right-4"
              onClick={onNextImage}
            >
              <ChevronRight />
            </ViewerNavigationButton>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-black via-black/72 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
            <div className="max-w-[65%] min-w-0">
              <div className="truncate text-xs font-medium tracking-tight text-white sm:text-sm">
                {image.title}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-white/58 sm:text-[11px]">
                <span>{imageResolutionLabel(imageResolution)}</span>
                <span>{image.aspectRatio}</span>
                <span>{formatViewerTimestamp(image.createdAt)}</span>
              </div>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              <ViewerActionButton
                label="Download image"
                onClick={() => void props.onDownloadImage(image)}
              >
                <Download />
              </ViewerActionButton>
              <ViewerActionButton
                label="View image details"
                onClick={() => props.onViewImageDetails(image)}
              >
                <Info />
              </ViewerActionButton>
              <ViewerActionButton
                label="Reveal in Finder"
                onClick={() => void props.onRevealImage(image)}
              >
                <FolderOpen />
              </ViewerActionButton>
              <ViewerActionButton
                label="Share image"
                onClick={() => void props.onShareImage(image)}
              >
                <Share2 />
              </ViewerActionButton>
              <ConfirmationDialog
                title="Archive image?"
                description={`Archive “${image.title}”? You can restore it later from Settings.`}
                confirmLabel="Archive"
                onConfirm={() => props.onArchiveImage(image)}
                trigger={
                  <ViewerActionButton label="Archive image">
                    <Archive />
                  </ViewerActionButton>
                }
              />
              <ViewerActionButton label="Close viewer" onClick={props.onClose}>
                <X />
              </ViewerActionButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ViewerNavigationButton({
  label,
  children,
  className,
  onClick,
}: {
  label: string
  children: ReactNode
  className: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "absolute top-1/2 z-10 size-8 -translate-y-1/2 rounded-full border border-white/10 bg-black/12 text-white/70 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-md hover:border-white/18 hover:bg-white/10 hover:text-white focus-visible:border-white/35 focus-visible:ring-white/20 sm:size-9",
        className
      )}
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function ViewerActionButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="rounded-full border border-white/14 bg-black/18 text-white/78 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md hover:border-white/24 hover:bg-white/10 hover:text-white"
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
