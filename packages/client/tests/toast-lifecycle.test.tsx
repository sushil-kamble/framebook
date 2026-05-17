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
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:reference"),
    })
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
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

  it("does not include already-notified jobs in later generation success toasts", async () => {
    mocks.framebookApi.createGeneration
      .mockResolvedValueOnce({ job: queuedGenerationJob })
      .mockResolvedValueOnce({
        job: secondQueuedGenerationJob,
        jobs: [secondQueuedGenerationJob, thirdQueuedGenerationJob],
      })
    mocks.framebookApi.getGenerationJob.mockImplementation((jobId: string) =>
      Promise.resolve({
        job:
          jobId === secondQueuedGenerationJob.id
            ? secondSucceededGenerationJob
            : jobId === thirdQueuedGenerationJob.id
              ? thirdSucceededGenerationJob
              : succeededGenerationJob,
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
      expect(mocks.toast.success).toHaveBeenCalledWith("Image generated")
    })

    fireEvent.change(
      screen.getByPlaceholderText("Describe the image you want to create..."),
      { target: { value: "Two more poster versions" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.toast.success).toHaveBeenCalledWith("2 images generated")
    })
    expect(mocks.toast.success).not.toHaveBeenCalledWith("3 images generated")
  })

  it("sends web context mode when research context is enabled", async () => {
    render(<FramebookApp routeScreen="topic" routeTopicId={topicSummary.id} />)

    fireEvent.change(
      await screen.findByPlaceholderText(
        "Describe the image you want to create..."
      ),
      { target: { value: "A lesser-known trek poster" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Research context" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.framebookApi.createGeneration).toHaveBeenCalledWith(
        topicSummary.id,
        expect.objectContaining({
          rawPrompt: "A lesser-known trek poster",
          contextMode: "web",
        }),
        []
      )
    })
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
      expect(
        screen.getByPlaceholderText("Describe the image you want to create...")
      ).toHaveProperty("value", "")
    })

    await act(() => {
      resolveGeneration({ job: queuedGenerationJob })
      return Promise.resolve()
    })
  })

  it("keeps pending generation placeholders scoped to the generating topic", async () => {
    let resolveGeneration: (value: { job: GenerationJob }) => void = () => {}
    mocks.framebookApi.listTopics.mockResolvedValue({
      topics: [topicSummary, secondTopicSummary],
    })
    mocks.framebookApi.createGeneration.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve
      })
    )
    const { rerender } = render(
      <FramebookApp routeScreen="topic" routeTopicId={topicSummary.id} />
    )

    fireEvent.change(
      await screen.findByPlaceholderText(
        "Describe the image you want to create..."
      ),
      { target: { value: "A mountain railway poster" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Generating image")).toBeTruthy()
    })

    rerender(
      <FramebookApp routeScreen="topic" routeTopicId={secondTopicSummary.id} />
    )

    await waitFor(() => {
      expect(
        screen.getAllByText(secondTopicSummary.name).length
      ).toBeGreaterThan(0)
    })

    expect(screen.queryByLabelText("Generating image")).toBeNull()

    await act(() => {
      resolveGeneration({ job: queuedGenerationJob })
      return Promise.resolve()
    })
  })

  it("sends attached reference images only with generation requests", async () => {
    const referenceImage = new File(["png"], "subject.png", {
      type: "image/png",
    })
    render(<FramebookApp routeScreen="topic" routeTopicId={topicSummary.id} />)

    fireEvent.change(
      await screen.findByPlaceholderText(
        "Describe the image you want to create..."
      ),
      { target: { value: "Change the t-shirt color" } }
    )
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [referenceImage] },
    })

    await screen.findByRole("img", { name: "Reference subject.png" })
    fireEvent.click(screen.getByRole("button", { name: "Enhance prompt" }))

    await waitFor(() => {
      expect(mocks.framebookApi.enhancePrompt).toHaveBeenCalledWith(
        topicSummary.id,
        { rawPrompt: "Change the t-shirt color" }
      )
    })

    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.framebookApi.createGeneration).toHaveBeenCalledWith(
        topicSummary.id,
        expect.objectContaining({
          rawPrompt: "Change the t-shirt color",
          enhancedPrompt: "A refined prompt",
        }),
        [referenceImage]
      )
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
    expect(screen.getByDisplayValue("A refined prompt")).toBeTruthy()
    expect(screen.getByText("Original prompt")).toBeTruthy()
    expect(screen.getByText("A mountain railway poster")).toBeTruthy()
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
  creativeModeId: "blue-pin-poster",
  archivedAt: null,
  createdAt: "2026-05-04T10:00:00.000Z",
  updatedAt: "2026-05-04T10:00:00.000Z",
  imageCount: 0,
  favoriteCount: 0,
  latestImageId: null,
  latestImageCreatedAt: null,
}

const secondTopicSummary: TopicSummary = {
  ...topicSummary,
  id: "topic-2",
  name: "Icon Studies",
  defaultAspectRatio: "1:1",
  creativeModeId: "icon-design",
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
  creativeModeId: "blue-pin-poster",
  referenceImages: [],
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

const secondQueuedGenerationJob: GenerationJob = {
  ...queuedGenerationJob,
  id: "job-2",
  title: "Second Poster",
  rawPrompt: "Two more poster versions",
  finalPrompt: "Two more poster versions",
}

const thirdQueuedGenerationJob: GenerationJob = {
  ...secondQueuedGenerationJob,
  id: "job-3",
  title: "Third Poster",
}

const secondSucceededGenerationJob: GenerationJob = {
  ...secondQueuedGenerationJob,
  status: "succeeded",
  imageId: "image-2",
}

const thirdSucceededGenerationJob: GenerationJob = {
  ...thirdQueuedGenerationJob,
  status: "succeeded",
  imageId: "image-3",
}
