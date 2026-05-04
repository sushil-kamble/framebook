import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { defaultTopicDraft } from "../src/app/lib/topic-form"
import { TopicEditorPage } from "../src/app/components/topic-editor-page"

describe("topic editor page", () => {
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
