import { act, render, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  applyThemeMode,
  defaultThemeMode,
  getInitialThemeMode,
  readStoredThemeMode,
  themeStorageKey,
  useThemeMode,
  writeStoredThemeMode,
} from "../src/app/lib/theme"

function ThemeModeProbe() {
  const { themeMode, setThemeMode } = useThemeMode()

  return createElement(
    "button",
    { type: "button", onClick: () => setThemeMode("light") },
    themeMode
  )
}

describe("theme helpers", () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ""
  })

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

  it("renders the hydration-safe default theme before client storage effects", () => {
    window.localStorage.setItem(themeStorageKey, "light")

    expect(renderToString(createElement(ThemeModeProbe))).toContain(
      defaultThemeMode
    )
  })

  it("applies the persisted theme after mount", async () => {
    window.localStorage.setItem(themeStorageKey, "light")

    render(createElement(ThemeModeProbe))

    await waitFor(() => {
      expect(screen.getByRole("button").textContent).toBe("light")
    })
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })

  it("persists explicit theme changes", async () => {
    render(createElement(ThemeModeProbe))

    await act(() => {
      screen.getByRole("button").click()
    })

    expect(window.localStorage.getItem(themeStorageKey)).toBe("light")
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })
})
