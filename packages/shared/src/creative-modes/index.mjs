import { creativeModeCatalog } from "./catalog.mjs"

export { creativeModeCatalog } from "./catalog.mjs"

export function listCreativeModes() {
  return creativeModeCatalog
}

export function getCreativeMode(id) {
  return creativeModeCatalog.find((mode) => mode.id === id)
}

export function isCreativeModeId(value) {
  return (
    typeof value === "string" &&
    creativeModeCatalog.some((mode) => mode.id === value)
  )
}

export function resolveCreativeMode(id) {
  return id ? getCreativeMode(id) : undefined
}
