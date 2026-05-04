import { render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { StarredScreen } from "../src/app/components/starred-screen"
import { FramebookApp } from "../src/app/framebook-app"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

describe("starred loading state", () => {
  it("shows the starred skeleton on first paint", () => {
    const html = renderToString(<FramebookApp routeScreen="starred" />)

    expect(html).toContain("Loading starred images")
    expect(html).not.toContain("No starred images yet")
  })

  it("renders two starred skeleton cards", () => {
    render(
      <StarredScreen
        images={[]}
        isLoading={true}
        onToggleFavorite={vi.fn()}
        onPreviewImage={vi.fn()}
        onViewImageDetails={vi.fn()}
      />
    )

    expect(
      screen.getByLabelText("Loading starred images").children
    ).toHaveLength(2)
  })
})
