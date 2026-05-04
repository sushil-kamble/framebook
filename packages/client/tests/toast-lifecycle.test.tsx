import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FramebookApp } from "../src/app/framebook-app"
import type {
  GenerationJob,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"

const mocks = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
  })

  return {
    navigate: vi.fn(),
    toast,
    framebookApi: {
      createGeneration: vi.fn(),
      enhancePrompt: vi.fn(),
      getGenerationJob: vi.fn(),
      listGenerationJobs: vi.fn(),
      listImages: vi.fn(),
      listStarredImages: vi.fn(),
      listTopics: vi.fn(),
    },
  }
})

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/topics/topic-1" }),
  useNavigate: () => mocks.navigate,
}))

vi.mock("sonner", () => ({
  toast: mocks.toast,
}))

vi.mock("@shared/api/framebook", () => ({
  framebookApi: mocks.framebookApi,
  framebookApiUrl: (input: string) => input,
}))

describe("toast lifecycle", () => {
  beforeEach(() => {
    mocks.framebookApi.listTopics.mockResolvedValue({ topics: [topicSummary] })
    mocks.framebookApi.listImages.mockResolvedValue({ images: [] })
    mocks.framebookApi.listStarredImages.mockResolvedValue({ images: [] })
    mocks.framebookApi.listGenerationJobs.mockResolvedValue({ jobs: [] })
    mocks.framebookApi.getGenerationJob.mockResolvedValue({
      job: succeededGenerationJob,
    })
    mocks.framebookApi.createGeneration.mockResolvedValue({
      job: queuedGenerationJob,
    })
    mocks.framebookApi.enhancePrompt.mockResolvedValue({
      enhancedPrompt: "A refined prompt",
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("dismisses the image generation loading toast before showing success", async () => {
    render(<FramebookApp routeScreen="topic" routeTopicId={topicSummary.id} />)

    fireEvent.change(
      await screen.findByPlaceholderText(
        "Describe the image you want to create..."
      ),
      { target: { value: "A mountain railway poster" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        "Your image is being generated",
        {
          id: "generation",
        }
      )
    })
    await waitFor(() => {
      expect(mocks.toast.dismiss).toHaveBeenCalledWith("generation")
      expect(mocks.toast.success).toHaveBeenCalledWith("Image generated")
    })
    expect(mocks.toast.dismiss.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.toast.success.mock.invocationCallOrder.at(-1) ?? 0
    )
  })

  it("shows generation loading UI before the create generation request resolves", async () => {
    let resolveGeneration: (value: { job: GenerationJob }) => void = () => {}
    mocks.framebookApi.createGeneration.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve
      })
    )
    render(<FramebookApp routeScreen="topic" routeTopicId={topicSummary.id} />)

    fireEvent.change(
      await screen.findByPlaceholderText(
        "Describe the image you want to create..."
      ),
      { target: { value: "A mountain railway poster" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Generating image")).toBeTruthy()
      expect(
        screen
          .getByRole("button", { name: "Generate" })
          .hasAttribute("disabled")
      ).toBe(true)
    })

    await act(() => {
      resolveGeneration({ job: queuedGenerationJob })
      return Promise.resolve()
    })
  })

  it("dismisses the prompt enhancement loading toast before showing success", async () => {
    render(<FramebookApp routeScreen="topic" routeTopicId={topicSummary.id} />)

    fireEvent.change(
      await screen.findByPlaceholderText(
        "Describe the image you want to create..."
      ),
      { target: { value: "A mountain railway poster" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Enhance prompt" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith("Enhancing prompt...", {
        id: "prompt-enhancement",
      })
      expect(mocks.toast.dismiss).toHaveBeenCalledWith("prompt-enhancement")
      expect(mocks.toast.success).toHaveBeenCalledWith("Prompt enhanced")
    })
    expect(mocks.toast.dismiss.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.toast.success.mock.invocationCallOrder.at(-1) ?? 0
    )
  })
})

const topicSummary: TopicSummary = {
  id: "topic-1",
  name: "Travel Posters",
  description: "Poster studies.",
  instruction: "Use vintage travel poster style.",
  defaultAspectRatio: "4:3",
  basePromptDetails: "Mountain railway",
  enhancerMode: "storyboard",
  archivedAt: null,
  createdAt: "2026-05-04T10:00:00.000Z",
  updatedAt: "2026-05-04T10:00:00.000Z",
  imageCount: 0,
  favoriteCount: 0,
  latestImageId: null,
  latestImageCreatedAt: null,
}

const queuedGenerationJob: GenerationJob = {
  id: "job-1",
  topicId: "topic-1",
  status: "queued",
  title: "Mountain Railway Poster",
  rawPrompt: "A mountain railway poster",
  enhancedPrompt: "",
  finalPrompt: "A mountain railway poster",
  aspectRatio: "4:3",
  resolutionPreset: "1k",
  imageId: null,
  error: null,
  createdAt: "2026-05-04T10:00:00.000Z",
  updatedAt: "2026-05-04T10:00:00.000Z",
}

const succeededGenerationJob: GenerationJob = {
  ...queuedGenerationJob,
  status: "succeeded",
  imageId: "image-1",
}
