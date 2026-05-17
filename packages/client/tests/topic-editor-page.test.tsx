import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { defaultTopicDraft } from "../src/app/lib/topic-form"
import { TopicEditorPage } from "../src/app/components/topic-editor-page"

describe("topic editor page", () => {
  const editorProps = {
    onCancel: vi.fn(),
    onTopicsClick: vi.fn(),
    onTopicClick: vi.fn(),
    onReferenceImageError: vi.fn(),
    onAddReferenceImages: vi.fn().mockResolvedValue(undefined),
    onRemoveReferenceImage: vi.fn().mockResolvedValue(undefined),
  }

  it("renders the base prompt and topic reference controls", () => {
    render(
      <TopicEditorPage
        editor={{
          mode: "create",
          draft: defaultTopicDraft,
        }}
        {...editorProps}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Base Prompt")).toBeTruthy()
    expect(screen.getByText("Reference Images")).toBeTruthy()
  })

  it("submits a new topic when only the name is filled", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <TopicEditorPage
        editor={{
          mode: "create",
          draft: defaultTopicDraft,
        }}
        {...editorProps}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByLabelText("Topic Name"), {
      target: { value: "Only Name" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Topic" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Only Name",
        }),
        []
      )
    })
    expect(screen.queryByText("Base prompt is required.")).toBeNull()
  })

  it("uses the shared breadcrumb header for edit mode", () => {
    render(
      <TopicEditorPage
        editor={{
          mode: "edit",
          draft: {
            ...defaultTopicDraft,
            name: "Travel Posters",
            basePrompt: "Vintage mountain travel posters.",
          },
          topicId: "topic-1",
          topicName: "Travel Posters",
        }}
        {...editorProps}
        onSubmit={vi.fn()}
      />
    )

    const breadcrumb = screen.getByLabelText("Breadcrumb")

    expect(breadcrumb.textContent).toContain("Topics")
    expect(breadcrumb.textContent).toContain("Travel Posters")
    expect(breadcrumb.textContent).toContain("Edit Topic")
    expect(screen.queryByRole("heading", { name: "Edit Topic" })).toBeNull()
  })

  it("adds dropped reference images to a new topic submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const referenceImage = new File(["png"], "subject.png", {
      type: "image/png",
    })

    render(
      <TopicEditorPage
        editor={{
          mode: "create",
          draft: defaultTopicDraft,
        }}
        {...editorProps}
        onSubmit={onSubmit}
      />
    )

    fireEvent.drop(screen.getByTestId("topic-editor-dropzone"), {
      dataTransfer: referenceImageDataTransfer(referenceImage),
    })
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Remove subject.png" })
      ).toBeTruthy()
    })
    fireEvent.change(screen.getByLabelText("Topic Name"), {
      target: { value: "Dropped References" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Topic" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Dropped References" }),
        [referenceImage]
      )
    })
  })

  it("uploads dropped reference images immediately while editing a topic", async () => {
    const onAddReferenceImages = vi.fn().mockResolvedValue(undefined)
    const referenceImage = new File(["png"], "subject.png", {
      type: "image/png",
    })

    render(
      <TopicEditorPage
        editor={{
          mode: "edit",
          draft: {
            ...defaultTopicDraft,
            name: "Travel Posters",
          },
          topicId: "topic-1",
          topicName: "Travel Posters",
        }}
        {...editorProps}
        onAddReferenceImages={onAddReferenceImages}
        onSubmit={vi.fn()}
      />
    )

    fireEvent.drop(screen.getByTestId("topic-editor-dropzone"), {
      dataTransfer: referenceImageDataTransfer(referenceImage),
    })

    await waitFor(() => {
      expect(onAddReferenceImages).toHaveBeenCalledWith("topic-1", [
        referenceImage,
      ])
    })
  })
})

function referenceImageDataTransfer(file: File) {
  return {
    files: [file],
    items: [
      {
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      },
    ],
    types: ["Files"],
  }
}
