import { creativeModeCatalog } from "./catalog"
import type { CreativeMode } from "./catalog"

export type { CreativeMode } from "./catalog"
export { creativeModeCatalog } from "./catalog"

export function listCreativeModes(): ReadonlyArray<CreativeMode> {
  return creativeModeCatalog
}

export function getCreativeMode(id: string): CreativeMode | undefined {
  return creativeModeCatalog.find((mode) => mode.id === id)
}

export function isCreativeModeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    creativeModeCatalog.some((mode) => mode.id === value)
  )
}

export function resolveCreativeMode(
  id: string | null | undefined
): CreativeMode | undefined {
  return id ? getCreativeMode(id) : undefined
}
