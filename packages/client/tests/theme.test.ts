import { describe, expect, it, vi } from "vitest"
import {
  applyThemeMode,
  defaultThemeMode,
  getInitialThemeMode,
  readStoredThemeMode,
  themeStorageKey,
  writeStoredThemeMode,
} from "../src/app/lib/theme"

describe("theme helpers", () => {
  it("reads only supported theme modes from storage", () => {
    expect(
      readStoredThemeMode({
        getItem: () => "light",
      })
    ).toBe("light")
    expect(
      readStoredThemeMode({
        getItem: () => "system",
      })
    ).toBeNull()
  })

  it("writes the selected theme mode to the shared storage key", () => {
    const setItem = vi.fn()

    writeStoredThemeMode("dark", { setItem })

    expect(setItem).toHaveBeenCalledWith(themeStorageKey, "dark")
  })

  it("applies the selected mode to the document root", () => {
    const root = document.createElement("html")

    applyThemeMode("light", root)
    expect(root.classList.contains("light")).toBe(true)
    expect(root.classList.contains("dark")).toBe(false)

    applyThemeMode("dark", root)
    expect(root.classList.contains("light")).toBe(false)
    expect(root.classList.contains("dark")).toBe(true)
  })

  it("uses the persisted value for initial client state", () => {
    window.localStorage.setItem(themeStorageKey, "light")

    expect(getInitialThemeMode()).toBe("light")
  })

  it("falls back to the default theme for invalid stored values", () => {
    window.localStorage.setItem(themeStorageKey, "system")

    expect(getInitialThemeMode()).toBe(defaultThemeMode)
  })
})
