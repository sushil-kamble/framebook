import { ImagePlus } from "lucide-react"
import { createPortal } from "react-dom"
import { cn } from "@shared/lib/utils"
import { referenceImageMessages } from "../lib/reference-images"

export function ReferenceImageDropOverlay({
  isRejecting,
  body,
}: {
  isRejecting: boolean
  body?: string
}) {
  const overlay = (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/82 px-6 text-center backdrop-blur-sm">
      <div className="pointer-events-none flex max-w-sm flex-col items-center">
        <div
          className={cn(
            "mb-4 grid size-14 place-items-center rounded-2xl border shadow-lg",
            isRejecting
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-ring/30 bg-ring/10 text-ring"
          )}
        >
          <ImagePlus className="size-6" />
        </div>
        <div className="text-2xl font-semibold tracking-tight">
          {isRejecting
            ? referenceImageMessages.dropUnsupportedTitle
            : referenceImageMessages.dropSupportedTitle}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {isRejecting
            ? referenceImageMessages.dropUnsupportedBody
            : (body ?? referenceImageMessages.dropSupportedBody)}
        </p>
      </div>
    </div>
  )

  if (typeof document === "undefined") {
    return overlay
  }

  return createPortal(overlay, document.body)
}
