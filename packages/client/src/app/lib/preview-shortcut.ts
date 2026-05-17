import { useCallback, useEffect, useRef } from "react"
import type { MouseEvent } from "react"

interface ActivePreviewShortcut {
  element: HTMLElement
  onPreview: () => void
}

let activePreviewShortcut: ActivePreviewShortcut | null = null
const previewShortcutElements = new Map<HTMLElement, () => void>()
let subscriberCount = 0
let lastPointerPosition: { clientX: number; clientY: number } | null = null
const PREVIEW_SHORTCUT_ATTRIBUTE = "data-framebook-preview-shortcut"

function handleWindowKeyDown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.key.toLowerCase() !== "v" ||
    isEditableTarget(event.target) ||
    isPreviewDialogOpen() ||
    (!activePreviewShortcut && !syncActivePreviewShortcutFromPointer())
  ) {
    return
  }

  const shortcut = activePreviewShortcut

  if (!shortcut) return

  event.preventDefault()
  shortcut.onPreview()
}

function handleWindowPointerMove(event: PointerEvent) {
  lastPointerPosition = { clientX: event.clientX, clientY: event.clientY }

  if (isPreviewDialogOpen()) return

  if (!activePreviewShortcut) return

  if (typeof document.elementFromPoint !== "function") return

  const target = document.elementFromPoint(event.clientX, event.clientY)

  if (
    !(target instanceof Node) ||
    !activePreviewShortcut.element.contains(target)
  ) {
    activePreviewShortcut = null
  }
}

export function refreshHoverPreviewShortcutAfterDialogClose() {
  window.setTimeout(() => {
    syncActivePreviewShortcutFromPointer()
  }, 0)
}

export function useHoverPreviewShortcut(onPreview: () => void) {
  const onPreviewRef = useRef(onPreview)
  const elementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onPreviewRef.current = onPreview

    const element = elementRef.current

    if (element) {
      previewShortcutElements.set(element, () => onPreviewRef.current())
    }
  }, [onPreview])

  useEffect(() => {
    subscriberCount += 1

    if (subscriberCount === 1) {
      window.addEventListener("keydown", handleWindowKeyDown)
      window.addEventListener("pointermove", handleWindowPointerMove)
    }

    return () => {
      const element = elementRef.current

      if (element) {
        previewShortcutElements.delete(element)
      }

      if (activePreviewShortcut?.element === element) {
        activePreviewShortcut = null
      }

      subscriberCount -= 1

      if (subscriberCount === 0) {
        window.removeEventListener("keydown", handleWindowKeyDown)
        window.removeEventListener("pointermove", handleWindowPointerMove)
      }
    }
  }, [])

  const setElementRef = useCallback((element: HTMLElement | null) => {
    const previousElement = elementRef.current

    if (previousElement && previousElement !== element) {
      previewShortcutElements.delete(previousElement)

      if (activePreviewShortcut?.element === previousElement) {
        activePreviewShortcut = null
      }
    }

    elementRef.current = element

    if (element) {
      previewShortcutElements.set(element, () => onPreviewRef.current())
    }
  }, [])

  return {
    ref: setElementRef,
    [PREVIEW_SHORTCUT_ATTRIBUTE]: "true",
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      lastPointerPosition = {
        clientX: event.clientX,
        clientY: event.clientY,
      }
      previewShortcutElements.set(event.currentTarget, () =>
        onPreviewRef.current()
      )
      setActivePreviewShortcut(event.currentTarget)
    },
  }
}

function syncActivePreviewShortcutFromPointer() {
  if (!lastPointerPosition) return false
  if (typeof document.elementFromPoint !== "function") return false

  const target = document.elementFromPoint(
    lastPointerPosition.clientX,
    lastPointerPosition.clientY
  )

  if (!(target instanceof Element)) {
    activePreviewShortcut = null
    return false
  }

  const element = target.closest<HTMLElement>(`[${PREVIEW_SHORTCUT_ATTRIBUTE}]`)

  if (!element || !setActivePreviewShortcut(element)) {
    activePreviewShortcut = null
    return false
  }

  return true
}

function setActivePreviewShortcut(element: HTMLElement) {
  const onPreview = previewShortcutElements.get(element)

  if (!onPreview) return false

  activePreviewShortcut = { element, onPreview }
  return true
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
