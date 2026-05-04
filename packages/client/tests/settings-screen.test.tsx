import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SettingsScreen } from "../src/app/components/settings-screen"

const mocks = vi.hoisted(() => ({
  framebookApi: {
    listArchivedImages: vi.fn(),
    listTopics: vi.fn(),
  },
}))

vi.mock("@shared/api/framebook", () => ({
  framebookApi: mocks.framebookApi,
  framebookApiUrl: (input: string) => input,
}))

describe("settings screen", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            codexAppServerConfigured: false,
            dataDir: "/tmp/framebook",
          }),
      })
    )
    mocks.framebookApi.listTopics.mockResolvedValue({ topics: [] })
    mocks.framebookApi.listArchivedImages.mockResolvedValue({ images: [] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("renders on the generated settings background stage", async () => {
    const { container } = render(
      <SettingsScreen onUnarchiveImage={vi.fn()} onUnarchiveTopic={vi.fn()} />
    )

    expect(container.firstElementChild?.className).toContain("settings-stage")
    expect(screen.getByLabelText("Breadcrumb").textContent).toContain(
      "Settings"
    )
    expect(await screen.findByText("/tmp/framebook")).toBeTruthy()
  })
})
