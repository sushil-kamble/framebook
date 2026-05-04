import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ImageDetailPage } from "../src/app/components/image-detail-page"
import { ImagePreviewDialog } from "../src/app/components/image-preview-dialog"
import { StarredScreen } from "../src/app/components/starred-screen"
import { TopicWorkspace } from "../src/app/components/topic-workspace"
import type {
  ImageRecord,
  TopicSummary,
} from "@framebook/shared/contracts/framebook"

describe("optimized image grids", () => {
  it("renders starred cards with responsive variant image attributes", () => {
    render(
      <StarredScreen
        images={[imageRecord]}
        isLoading={false}
        onToggleFavorite={vi.fn()}
        onPreviewImage={vi.fn()}
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
  })

  it("renders topic cards with responsive variant image attributes", () => {
    render(
      <TopicWorkspace
        topic={topicSummary}
        images={[imageRecord]}
        promptValue=""
        hasGenerationPrompt={false}
        selectedAspectRatio="4:3"
        selectedResolutionPreset="1k"
        favoriteOnly={false}
        job={null}
        isEnhancing={false}
        isLoadingImages={false}
        onBack={vi.fn()}
        onEditTopic={vi.fn()}
        onArchiveTopic={vi.fn()}
        onPromptChange={vi.fn()}
        onAspectRatioChange={vi.fn()}
        onResolutionPresetChange={vi.fn()}
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
  })

  it("keeps detail and preview views on the original image URL", () => {
    const { container: detailContainer, unmount } = render(
      <ImageDetailPage
        image={imageRecord}
        onBack={vi.fn()}
        onTopicsClick={vi.fn()}
        onRevealImage={vi.fn()}
        onPreviewImage={vi.fn()}
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
    unmount()

    render(
      <ImagePreviewDialog
        image={imageRecord}
        onClose={vi.fn()}
        onDownloadImage={vi.fn()}
        onRevealImage={vi.fn()}
        onShareImage={vi.fn()}
        onArchiveImage={vi.fn()}
      />
    )

    const previewImage = screen.getByRole("img", { name: imageRecord.title })

    expect(previewImage.getAttribute("src")).toContain(
      "/api/images/image-1/file"
    )
    expect(previewImage.hasAttribute("srcset")).toBe(false)
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
  imageCount: 1,
  favoriteCount: 1,
  latestImageId: "image-1",
  latestImageCreatedAt: "2026-05-04T10:00:00.000Z",
}

const imageRecord: ImageRecord = {
  id: "image-1",
  topicId: "topic-1",
  generationJobId: "job-1",
  title: "Mountain Railway Poster",
  rawPrompt: "Mountain railway",
  enhancedPrompt: "Enhanced mountain railway.",
  finalPrompt: "Enhanced mountain railway.",
  aspectRatio: "4:3",
  enhancerMode: "storyboard",
  topicSnapshot: {
    id: "topic-1",
    name: "Travel Posters",
    instruction: "Use vintage travel poster style.",
    defaultAspectRatio: "4:3",
    basePromptDetails: "Mountain railway",
    enhancerMode: "storyboard",
  },
  favorite: true,
  archivedAt: null,
  fileName: "image-1.png",
  mimeType: "image/png",
  width: 1200,
  height: 900,
  placeholderColor: "#336699",
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
