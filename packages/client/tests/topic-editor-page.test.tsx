import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { defaultTopicDraft } from "../src/app/lib/topic-form"
import { TopicEditorPage } from "../src/app/components/topic-editor-page"

describe("topic editor page", () => {
  it("does not preselect a creative mode for new topics", () => {
    render(
      <TopicEditorPage
        editor={{
          mode: "create",
          draft: defaultTopicDraft,
        }}
        onCancel={vi.fn()}
        onTopicsClick={vi.fn()}
        onTopicClick={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(
      screen.getByRole("combobox", { name: "Creative mode" }).textContent
    ).toContain("Select creative mode")
    expect(screen.queryByText("Animal Infographic")).toBeNull()
  })

  it("submits a new topic when only the name is filled", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <TopicEditorPage
        editor={{
          mode: "create",
          draft: defaultTopicDraft,
        }}
        onCancel={vi.fn()}
        onTopicsClick={vi.fn()}
        onTopicClick={vi.fn()}
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
          instruction: "",
          creativeModeId: "",
        })
      )
    })
    expect(screen.queryByText("Topic instruction is required.")).toBeNull()
    expect(screen.queryByText("Creative mode is required.")).toBeNull()
  })

  it("uses the shared breadcrumb header for edit mode", () => {
    render(
      <TopicEditorPage
        editor={{
          mode: "edit",
          draft: {
            ...defaultTopicDraft,
            name: "Travel Posters",
            instruction: "Vintage mountain travel posters.",
          },
          topicId: "topic-1",
          topicName: "Travel Posters",
        }}
        onCancel={vi.fn()}
        onTopicsClick={vi.fn()}
        onTopicClick={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    const breadcrumb = screen.getByLabelText("Breadcrumb")

    expect(breadcrumb.textContent).toContain("Topics")
    expect(breadcrumb.textContent).toContain("Travel Posters")
    expect(breadcrumb.textContent).toContain("Edit Topic")
    expect(screen.queryByRole("heading", { name: "Edit Topic" })).toBeNull()
  })
})
