import { useEffect, useRef } from "react"
import type { MouseEvent } from "react"

interface ActivePreviewShortcut {
  element: HTMLElement
  onPreview: () => void
}

let activePreviewShortcut: ActivePreviewShortcut | null = null
let subscriberCount = 0

function handleWindowKeyDown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.key.toLowerCase() !== "v" ||
    isEditableTarget(event.target) ||
    isPreviewDialogOpen() ||
    !activePreviewShortcut
  ) {
    return
  }

  event.preventDefault()
  activePreviewShortcut.onPreview()
}

function handleWindowPointerMove(event: PointerEvent) {
  if (!activePreviewShortcut) return

  const target = document.elementFromPoint(event.clientX, event.clientY)

  if (
    !(target instanceof Node) ||
    !activePreviewShortcut.element.contains(target)
  ) {
    activePreviewShortcut = null
  }
}

export function useHoverPreviewShortcut(onPreview: () => void) {
  const onPreviewRef = useRef(onPreview)
  const elementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onPreviewRef.current = onPreview
  }, [onPreview])

  useEffect(() => {
    subscriberCount += 1

    if (subscriberCount === 1) {
      window.addEventListener("keydown", handleWindowKeyDown)
      window.addEventListener("pointermove", handleWindowPointerMove)
    }

    return () => {
      if (activePreviewShortcut?.element === elementRef.current) {
        activePreviewShortcut = null
      }

      subscriberCount -= 1

      if (subscriberCount === 0) {
        window.removeEventListener("keydown", handleWindowKeyDown)
        window.removeEventListener("pointermove", handleWindowPointerMove)
      }
    }
  }, [])

  return {
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      elementRef.current = event.currentTarget
      activePreviewShortcut = {
        element: event.currentTarget,
        onPreview: () => onPreviewRef.current(),
      }
    },
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function isPreviewDialogOpen() {
  return Boolean(
    document.querySelector("[data-framebook-preview-dialog='true']")
  )
}
