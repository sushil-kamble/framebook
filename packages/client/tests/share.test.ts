import { describe, expect, it, vi } from "vitest"
import { copyTextToClipboard } from "../src/app/lib/share"

describe("share helpers", () => {
  it("uses async clipboard when permission is available", async () => {
    const writeText = vi.fn(() => Promise.resolve())

    await expect(
      copyTextToClipboard("https://framebook.local/image-1", {
        clipboard: { writeText },
      })
    ).resolves.toBe(true)

    expect(writeText).toHaveBeenCalledWith("https://framebook.local/image-1")
  })

  it("uses selection copy before async clipboard when available", async () => {
    const writeText = vi.fn(() => Promise.reject(new DOMException("Denied")))
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })

    await expect(
      copyTextToClipboard("https://framebook.local/image-1", {
        clipboard: { writeText },
        document,
      })
    ).resolves.toBe(true)

    expect(execCommand).toHaveBeenCalledWith("copy")
    expect(writeText).not.toHaveBeenCalled()
    Reflect.deleteProperty(document, "execCommand")
  })
})
