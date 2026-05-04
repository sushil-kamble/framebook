interface ClipboardWriter {
  writeText: (text: string) => Promise<void>
}

interface CopyTextOptions {
  clipboard?: ClipboardWriter | null
  document?: Document
}

export async function copyTextToClipboard(
  text: string,
  options: CopyTextOptions = {}
) {
  if (copyTextWithSelection(text, options.document ?? document)) {
    return true
  }

  const clipboard =
    options.clipboard === undefined
      ? "clipboard" in navigator
        ? navigator.clipboard
        : null
      : options.clipboard

  if (clipboard !== null) {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      // Automatic copy is best effort; callers can offer a manual fallback.
    }
  }

  return false
}

function copyTextWithSelection(text: string, targetDocument: Document) {
  if (typeof targetDocument.execCommand !== "function") {
    return false
  }

  const textarea = targetDocument.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "0"
  textarea.style.opacity = "0"

  targetDocument.body.append(textarea)
  textarea.focus()
  textarea.select()

  try {
    return targetDocument.execCommand("copy")
  } finally {
    textarea.remove()
  }
}
