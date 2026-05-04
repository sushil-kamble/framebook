import { ImageIcon, Info, Star } from "lucide-react"
import { cn } from "@shared/lib/utils"
import {
  formatDate,
  imageFileUrl,
  imageGridSizes,
  imageSrcSet,
  imageVariantUrl,
} from "../lib/utils"
import type { ImageRecord } from "@framebook/shared/contracts/framebook"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"

export function StarredScreen({
  images,
  isLoading,
  onToggleFavorite,
  onPreviewImage,
  onViewImageDetails,
}: {
  images: Array<ImageRecord>
  isLoading: boolean
  onToggleFavorite: (image: ImageRecord) => void
  onPreviewImage: (image: ImageRecord) => void
  onViewImageDetails: (image: ImageRecord) => void
}) {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Starred
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Images you have starred across your active topics.
        </p>
      </header>

      {isLoading ? <StarredGridSkeleton /> : null}

      {!isLoading && images.length === 0 ? (
        <div className="relative grid min-h-100 place-items-center overflow-hidden rounded-xl border border-dashed border-border/60 text-center">
          <div className="pointer-events-none absolute inset-0 framer-grid opacity-20" />
          <div className="relative px-6 py-10">
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground">
              <ImageIcon className="size-4" />
            </div>
            <div className="text-sm font-semibold">No starred images yet</div>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Open a topic and star individual images to collect them here.
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((image, index) => {
            const srcSet = imageSrcSet(image)

            return (
              <article
                key={image.id}
                className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm transition-all duration-200 hover:border-ring/30 hover:shadow-md hover:shadow-black/15 dark:hover:border-white/12 dark:hover:shadow-black/30"
              >
                <button
                  type="button"
                  className="block size-full text-left"
                  onClick={() => onPreviewImage(image)}
                  aria-label={`Preview ${image.title}`}
                >
                  <img
                    src={
                      srcSet
                        ? imageVariantUrl(image.id, 480)
                        : imageFileUrl(image.id)
                    }
                    srcSet={srcSet}
                    sizes={imageGridSizes("starred")}
                    alt={image.title}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    decoding="async"
                    fetchPriority={index < 2 ? "high" : undefined}
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-3 pt-14">
                  <div className="line-clamp-1 text-xs font-semibold text-white">
                    {image.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/55">
                    <span className="line-clamp-1">
                      {image.topicSnapshot.name}
                    </span>
                    <span>·</span>
                    <span>{formatDate(image.createdAt)}</span>
                  </div>
                </div>

                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => onViewImageDetails(image)}
                    aria-label={`View details for ${image.title}`}
                    title="View details"
                  >
                    <Info />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => onToggleFavorite(image)}
                    aria-label={
                      image.favorite ? "Remove from starred" : "Star image"
                    }
                    title={
                      image.favorite ? "Remove from starred" : "Star image"
                    }
                  >
                    <Star
                      className={cn(
                        image.favorite ? "fill-ring text-ring" : ""
                      )}
                    />
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function StarredGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Loading starred images">
      {["first", "second"].map((key) => (
        <div
          key={key}
          className="aspect-4/3 overflow-hidden rounded-2xl border border-border/50 bg-muted"
        >
          <Skeleton className="size-full rounded-none" />
        </div>
      ))}
    </div>
  )
}
