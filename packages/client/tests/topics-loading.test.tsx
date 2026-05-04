import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TopicsScreen } from "../src/app/components/topics-screen"

describe("topics loading state", () => {
  it("renders two topic skeleton cards", () => {
    render(
      <TopicsScreen
        topics={[]}
        isLoading={true}
        onCreateTopic={vi.fn()}
        onOpenTopic={vi.fn()}
        onEditTopic={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Loading topics").children).toHaveLength(2)
  })
})
