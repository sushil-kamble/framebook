import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { ImageDetailPage } from "../src/app/components/image-detail-page"
import { ImagePreviewDialog } from "../src/app/components/image-preview-dialog"
import { StarredScreen } from "../src/app/components/starred-screen"
import { TopicWorkspace } from "../src/app/components/topic-workspace"
import type {
  GenerationJob,
  ImageRecord,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"

describe("optimized image grids", () => {
  it("renders starred cards with responsive variant image attributes", async () => {
    const onPreviewImage = vi.fn()

    render(
      <StarredScreen
        images={[imageRecord]}
        isLoading={false}
        onToggleFavorite={vi.fn()}
        onPreviewImage={onPreviewImage}
        onViewImageDetails={vi.fn()}
      />
    )

    const image = screen.getByRole("img", { name: imageRecord.title })

    expect(image.getAttribute("src")).toContain(
      "/api/images/image-1/variants/480"
    )
    expect(image.getAttribute("srcset")).toContain(
      "/api/images/image-1/variants/320 320w"
    )
    expect(image.getAttribute("sizes")).toBe("(min-width: 768px) 50vw, 50vw")
    expect(image.getAttribute("loading")).toBe("lazy")
    expect(image.getAttribute("decoding")).toBe("async")
    expect(image.getAttribute("width")).toBe("1200")
    expect(image.getAttribute("height")).toBe("900")
    expect(image.getAttribute("fetchpriority")).toBe("high")

    fireEvent.mouseEnter(image.closest("article")!)
    fireEvent.keyDown(window, { key: "v" })

    await waitFor(() =>
      expect(onPreviewImage).toHaveBeenCalledWith(imageRecord)
    )
  })

  it("renders topic cards with responsive variant image attributes", async () => {
    const onPreviewImage = vi.fn()

    render(
      <TopicWorkspace
        topic={topicSummary}
        images={[imageRecord]}
        promptValue=""
        selectedTopicReferenceImages={[]}
        promptReferenceImages={[]}
        selectedAspectRatio="4:3"
        favoriteOnly={false}
        job={null}
        isEnhancing={false}
        isCreatingGeneration={false}
        isLoadingImages={false}
        onBack={vi.fn()}
        onEditTopic={vi.fn()}
        onArchiveTopic={vi.fn()}
        onPromptChange={vi.fn()}
        onAddPromptReferenceImages={vi.fn()}
        onRemovePromptReferenceImage={vi.fn()}
        onRemoveSelectedTopicReferenceImage={vi.fn()}
        onReferenceImageError={vi.fn()}
        onAspectRatioChange={vi.fn()}
        onEnhancePrompt={vi.fn()}
        onGenerate={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={onPreviewImage}
        onViewImageDetails={vi.fn()}
        onDownloadImage={vi.fn()}
        onFavoriteFilterChange={vi.fn()}
      />
    )

    const image = screen.getByRole("img", { name: imageRecord.title })

    expect(image.getAttribute("src")).toContain(
      "/api/images/image-1/variants/480"
    )
    expect(image.getAttribute("srcset")).toContain(
      "/api/images/image-1/variants/1024 1024w"
    )
    expect(image.getAttribute("sizes")).toBe("(min-width: 1024px) 33vw, 33vw")
    expect(image.getAttribute("loading")).toBe("lazy")
    expect(image.getAttribute("decoding")).toBe("async")
    expect(image.getAttribute("width")).toBe("1200")
    expect(image.getAttribute("height")).toBe("900")
    expect(image.getAttribute("fetchpriority")).toBe("high")

    fireEvent.mouseEnter(image.closest("article")!)
    fireEvent.keyDown(window, { key: "v" })

    await waitFor(() =>
      expect(onPreviewImage).toHaveBeenCalledWith(imageRecord)
    )
  })

  it("keeps generation controls usable while background jobs are active", () => {
    const onGenerate = vi.fn()

    render(
      <TopicWorkspace
        topic={topicSummary}
        images={[]}
        promptValue="A second poster prompt"
        selectedTopicReferenceImages={[]}
        promptReferenceImages={[]}
        selectedAspectRatio="4:3"
        favoriteOnly={false}
        jobs={[runningGenerationJob]}
        isEnhancing={false}
        isCreatingGeneration={false}
        isLoadingImages={false}
        onBack={vi.fn()}
        onEditTopic={vi.fn()}
        onArchiveTopic={vi.fn()}
        onPromptChange={vi.fn()}
        onAddPromptReferenceImages={vi.fn()}
        onRemovePromptReferenceImage={vi.fn()}
        onRemoveSelectedTopicReferenceImage={vi.fn()}
        onReferenceImageError={vi.fn()}
        onAspectRatioChange={vi.fn()}
        onEnhancePrompt={vi.fn()}
        onGenerate={onGenerate}
        onToggleFavorite={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={vi.fn()}
        onViewImageDetails={vi.fn()}
        onDownloadImage={vi.fn()}
        onFavoriteFilterChange={vi.fn()}
      />
    )

    const generateButton = screen.getByRole("button", { name: "Generate" })
    expect(generateButton.hasAttribute("disabled")).toBe(false)

    fireEvent.click(generateButton)

    expect(onGenerate).toHaveBeenCalledOnce()
  })

  it("adds active and pending generation placeholders together", () => {
    render(
      <TopicWorkspace
        topic={topicSummary}
        images={[]}
        promptValue="A poster prompt"
        selectedTopicReferenceImages={[]}
        promptReferenceImages={[]}
        selectedAspectRatio="4:3"
        favoriteOnly={false}
        jobs={[runningGenerationJob]}
        isEnhancing={false}
        isCreatingGeneration={true}
        creatingGenerationVersionCount={4}
        isLoadingImages={false}
        onBack={vi.fn()}
        onEditTopic={vi.fn()}
        onArchiveTopic={vi.fn()}
        onPromptChange={vi.fn()}
        onAddPromptReferenceImages={vi.fn()}
        onRemovePromptReferenceImage={vi.fn()}
        onRemoveSelectedTopicReferenceImage={vi.fn()}
        onReferenceImageError={vi.fn()}
        onAspectRatioChange={vi.fn()}
        onEnhancePrompt={vi.fn()}
        onGenerate={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={vi.fn()}
        onViewImageDetails={vi.fn()}
        onDownloadImage={vi.fn()}
        onFavoriteFilterChange={vi.fn()}
      />
    )

    expect(screen.getAllByLabelText("Generating image")).toHaveLength(5)
  })

  it("reopens the same hovered image when v is pressed after closing preview", async () => {
    render(<PreviewToggleHarness />)

    const image = screen.getByRole("img", { name: imageRecord.title })

    fireEvent.mouseEnter(image.closest("article")!)
    fireEvent.keyDown(window, { key: "v" })

    await waitFor(() => {
      expect(
        document.querySelector("[data-framebook-preview-dialog='true']")
      ).toBeTruthy()
    })

    fireEvent.keyDown(window, { key: "v" })

    await waitFor(() => {
      expect(
        document.querySelector("[data-framebook-preview-dialog='true']")
      ).toBeNull()
    })

    fireEvent.keyDown(window, { key: "v" })

    await waitFor(() => {
      expect(
        document.querySelector("[data-framebook-preview-dialog='true']")
      ).toBeTruthy()
    })
  })

  it("opens the image under the pointer after preview is closed with v", async () => {
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(
      document,
      "elementFromPoint"
    )
    const elementFromPoint = vi.fn()

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: elementFromPoint,
    })

    try {
      render(<PreviewToggleHarness images={[imageRecord, secondImageRecord]} />)

      const firstImage = screen.getByRole("img", { name: imageRecord.title })
      const secondImage = screen.getByRole("img", {
        name: secondImageRecord.title,
      })
      const firstCard = firstImage.closest("article")!
      const secondCard = secondImage.closest("article")!

      fireEvent.mouseEnter(firstCard, { clientX: 10, clientY: 10 })
      fireEvent.keyDown(window, { key: "v" })

      await waitFor(() => {
        expect(
          document.querySelector("[data-framebook-preview-dialog='true']")
        ).toBeTruthy()
      })

      elementFromPoint.mockReturnValue(secondCard)
      fireEvent.pointerMove(window, { clientX: 10, clientY: 10 })
      fireEvent.keyDown(window, { key: "v" })

      await waitFor(() => {
        expect(
          document.querySelector("[data-framebook-preview-dialog='true']")
        ).toBeNull()
      })
      await waitFor(() => expect(elementFromPoint).toHaveBeenCalled())

      fireEvent.keyDown(window, { key: "v" })

      await waitFor(() => {
        expect(
          document
            .querySelector("[data-framebook-preview-dialog='true'] img")
            ?.getAttribute("src")
        ).toContain("/api/images/image-2/file")
      })
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(
          document,
          "elementFromPoint",
          originalElementFromPoint
        )
      } else {
        Reflect.deleteProperty(document, "elementFromPoint")
      }
    }
  })

  it("keeps detail and preview views on the original image URL", async () => {
    const onPreviewImage = vi.fn()
    const { container: detailContainer, unmount } = render(
      <ImageDetailPage
        image={imageRecord}
        onBack={vi.fn()}
        onTopicsClick={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={onPreviewImage}
        onDownloadImage={vi.fn()}
        onShareImage={vi.fn()}
      />
    )

    expect(detailContainer.querySelector("img")?.getAttribute("src")).toContain(
      "/api/images/image-1/file"
    )
    expect(detailContainer.querySelector("img")?.hasAttribute("srcset")).toBe(
      false
    )
    expect(screen.getByText("Image generation prompt")).toBeTruthy()
    expect(
      screen.queryByText(/<Trusted Framebook generation contract>/)
    ).toBeNull()
    expect(screen.getByText("Enhanced prompt")).toBeTruthy()
    expect(screen.queryByText("User prompt")).toBeNull()
    expect(screen.queryByText(imageRecord.rawPrompt)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Full" }))
    expect(
      screen.getByText(/<Trusted Framebook generation contract>/)
    ).toBeTruthy()
    expect(screen.getByText(/Final image prompt:/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Default" }))
    expect(
      screen.queryByText(/<Trusted Framebook generation contract>/)
    ).toBeNull()

    fireEvent.mouseEnter(
      detailContainer.querySelector("img")!.closest("button")!
    )
    fireEvent.keyDown(window, { key: "v" })

    await waitFor(() =>
      expect(onPreviewImage).toHaveBeenCalledWith(imageRecord)
    )
    unmount()

    const { unmount: unmountExactPromptDetail } = render(
      <ImageDetailPage
        image={{
          ...imageRecord,
          enhancedPrompt: imageRecord.rawPrompt,
          finalPrompt: imageRecord.rawPrompt,
        }}
        onBack={vi.fn()}
        onTopicsClick={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={vi.fn()}
        onDownloadImage={vi.fn()}
        onShareImage={vi.fn()}
      />
    )

    expect(screen.getByText("Exact prompt")).toBeTruthy()
    unmountExactPromptDetail()

    const onClosePreview = vi.fn()

    render(
      <ImagePreviewDialog
        image={imageRecord}
        onClose={onClosePreview}
        onDownloadImage={vi.fn()}
        onRevealImage={vi.fn()}
        onShareImage={vi.fn()}
        onArchiveImage={vi.fn()}
        onViewImageDetails={vi.fn()}
      />
    )

    const previewImage = screen.getByRole("img", { name: imageRecord.title })

    expect(previewImage.getAttribute("src")).toContain(
      "/api/images/image-1/file"
    )
    expect(previewImage.hasAttribute("srcset")).toBe(false)

    fireEvent.keyDown(window, { key: "v" })

    expect(onClosePreview).toHaveBeenCalledOnce()
  })

  it("cycles preview images with navigation buttons and arrow keys", () => {
    const onPreviousImage = vi.fn()
    const onNextImage = vi.fn()

    render(
      <ImagePreviewDialog
        image={imageRecord}
        onClose={vi.fn()}
        onDownloadImage={vi.fn()}
        onRevealImage={vi.fn()}
        onShareImage={vi.fn()}
        onArchiveImage={vi.fn()}
        onViewImageDetails={vi.fn()}
        onPreviousImage={onPreviousImage}
        onNextImage={onNextImage}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Next image" }))
    expect(onNextImage).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "Previous image" }))
    expect(onPreviousImage).toHaveBeenCalledOnce()

    fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.keyDown(window, { key: "ArrowLeft" })

    expect(onNextImage).toHaveBeenCalledTimes(2)
    expect(onPreviousImage).toHaveBeenCalledTimes(2)
  })

  it("confirms before archiving an image from the preview dialog", async () => {
    const onArchiveImage = vi.fn().mockResolvedValue(undefined)

    render(
      <ImagePreviewDialog
        image={imageRecord}
        onClose={vi.fn()}
        onDownloadImage={vi.fn()}
        onRevealImage={vi.fn()}
        onShareImage={vi.fn()}
        onArchiveImage={onArchiveImage}
        onViewImageDetails={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Archive image" }))

    expect(screen.getByText("Archive image?")).toBeTruthy()
    expect(onArchiveImage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Archive" }))

    await waitFor(() =>
      expect(onArchiveImage).toHaveBeenCalledWith(imageRecord)
    )
  })

  it("opens image details from the preview dialog", () => {
    const onViewImageDetails = vi.fn()

    render(
      <ImagePreviewDialog
        image={imageRecord}
        onClose={vi.fn()}
        onDownloadImage={vi.fn()}
        onRevealImage={vi.fn()}
        onShareImage={vi.fn()}
        onArchiveImage={vi.fn()}
        onViewImageDetails={onViewImageDetails}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "View image details" }))

    expect(onViewImageDetails).toHaveBeenCalledWith(imageRecord)
  })

  it("renders reference images on image detail", () => {
    render(
      <ImageDetailPage
        image={{
          ...imageRecord,
          referenceImages: [
            {
              id: "reference-1",
              fileName: "references/job-1/reference-1.png",
              originalName: "subject.png",
              mimeType: "image/png",
              sizeBytes: 123,
              width: 64,
              height: 48,
              createdAt: "2026-05-04T10:00:00.000Z",
            },
          ],
        }}
        onBack={vi.fn()}
        onTopicsClick={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={vi.fn()}
        onDownloadImage={vi.fn()}
        onShareImage={vi.fn()}
      />
    )

    expect(screen.getByRole("img", { name: "subject.png" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "subject.png" }).getAttribute("href")
    ).toContain("/api/images/image-1/references/reference-1/file")
  })
})

function PreviewToggleHarness(props: { images?: Array<ImageRecord> }) {
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null)

  const togglePreviewImage = (image: ImageRecord) => {
    setPreviewImage((current) => (current?.id === image.id ? null : image))
  }

  return (
    <>
      <TopicWorkspace
        topic={topicSummary}
        images={props.images ?? [imageRecord]}
        promptValue=""
        selectedTopicReferenceImages={[]}
        promptReferenceImages={[]}
        selectedAspectRatio="4:3"
        favoriteOnly={false}
        job={null}
        isEnhancing={false}
        isCreatingGeneration={false}
        isLoadingImages={false}
        onBack={vi.fn()}
        onEditTopic={vi.fn()}
        onArchiveTopic={vi.fn()}
        onPromptChange={vi.fn()}
        onAddPromptReferenceImages={vi.fn()}
        onRemovePromptReferenceImage={vi.fn()}
        onRemoveSelectedTopicReferenceImage={vi.fn()}
        onReferenceImageError={vi.fn()}
        onAspectRatioChange={vi.fn()}
        onEnhancePrompt={vi.fn()}
        onGenerate={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={togglePreviewImage}
        onViewImageDetails={vi.fn()}
        onDownloadImage={vi.fn()}
        onFavoriteFilterChange={vi.fn()}
      />
      <ImagePreviewDialog
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onDownloadImage={vi.fn()}
        onRevealImage={vi.fn()}
        onShareImage={vi.fn()}
        onArchiveImage={vi.fn()}
        onViewImageDetails={vi.fn()}
      />
    </>
  )
}

const topicSummary: TopicSummary = {
  id: "topic-1",
  name: "Travel Posters",
  defaultAspectRatio: "4:3",
  basePrompt: "Mountain railway",
  referenceImages: [],
  archivedAt: null,
  createdAt: "2026-05-04T10:00:00.000Z",
  updatedAt: "2026-05-04T10:00:00.000Z",
  imageCount: 1,
  favoriteCount: 1,
  latestImageId: "image-1",
  latestImageCreatedAt: "2026-05-04T10:00:00.000Z",
}

const runningGenerationJob: GenerationJob = {
  id: "job-running",
  topicId: "topic-1",
  status: "running",
  title: "Running Poster",
  rawPrompt: "A running poster prompt",
  enhancedPrompt: "A running poster prompt",
  finalPrompt: "A running poster prompt",
  aspectRatio: "4:3",
  referenceImages: [],
  imageId: null,
  error: null,
  createdAt: "2026-05-04T10:00:00.000Z",
  updatedAt: "2026-05-04T10:00:00.000Z",
}

const imageRecord: ImageRecord = {
  id: "image-1",
  topicId: "topic-1",
  generationJobId: "job-1",
  title: "Mountain Railway Poster",
  rawPrompt: "Mountain railway",
  enhancedPrompt: "Enhanced mountain railway.",
  finalPrompt: "Enhanced mountain railway.",
  imageGenerationPrompt: `<Trusted Framebook generation contract>
- Generate exactly one Framebook image using the available image creation skill/tool.
- Do not create a placeholder, SVG stand-in, HTML/CSS drawing, or text-only artifact. The output must be a real bitmap PNG image.
- Generation requirements:
  - Aspect ratio: 4:3
</Trusted Framebook generation contract>

<Untrusted creative input>
Topic: Travel Posters
Base prompt: Mountain railway

Final image prompt:
Enhanced mountain railway.
</Untrusted creative input>`,
  aspectRatio: "4:3",
  topicSnapshot: topicSummary,
  favorite: true,
  archivedAt: null,
  fileName: "image-1.png",
  mimeType: "image/png",
  width: 1200,
  height: 900,
  placeholderColor: "#336699",
  referenceImages: [],
  variants: [
    {
      width: 320,
      height: 240,
      fileName: "image-1-320w.webp",
      mimeType: "image/webp",
    },
    {
      width: 480,
      height: 360,
      fileName: "image-1-480w.webp",
      mimeType: "image/webp",
    },
    {
      width: 768,
      height: 576,
      fileName: "image-1-768w.webp",
      mimeType: "image/webp",
    },
    {
      width: 1024,
      height: 768,
      fileName: "image-1-1024w.webp",
      mimeType: "image/webp",
    },
  ],
  createdAt: "2026-05-04T10:00:00.000Z",
}

const secondImageRecord: ImageRecord = {
  ...imageRecord,
  id: "image-2",
  title: "Coastal Tram Poster",
  fileName: "image-2.png",
  createdAt: "2026-05-04T10:05:00.000Z",
  variants: (imageRecord.variants ?? []).map((variant) => ({
    ...variant,
    fileName: variant.fileName.replace("image-1", "image-2"),
  })),
}
