import { useEffect, useState } from "react"

export type ThemeMode = "light" | "dark"

export const defaultThemeMode: ThemeMode = "dark"
export const themeStorageKey = "framebook-theme"

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark"
}

export function readStoredThemeMode(
  storage: Pick<Storage, "getItem"> = window.localStorage
): ThemeMode | null {
  const storedTheme = storage.getItem(themeStorageKey)

  return isThemeMode(storedTheme) ? storedTheme : null
}

export function writeStoredThemeMode(
  themeMode: ThemeMode,
  storage: Pick<Storage, "setItem"> = window.localStorage
) {
  storage.setItem(themeStorageKey, themeMode)
}

export function applyThemeMode(
  themeMode: ThemeMode,
  root: HTMLElement = document.documentElement
) {
  root.classList.toggle("light", themeMode === "light")
  root.classList.toggle("dark", themeMode === "dark")
}

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return defaultThemeMode
  }

  try {
    return readStoredThemeMode() ?? defaultThemeMode
  } catch (storageError) {
    console.warn("Unable to read saved Framebook theme.", storageError)
    return defaultThemeMode
  }
}

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)

  useEffect(() => {
    applyThemeMode(themeMode)

    try {
      writeStoredThemeMode(themeMode)
    } catch (storageError) {
      console.warn("Unable to save Framebook theme.", storageError)
    }
  }, [themeMode])

  return { themeMode, setThemeMode }
}
