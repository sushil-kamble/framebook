import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { FramebookApp } from "../src/app/framebook-app"

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/topics/topic-1/images/image-1" }),
  useNavigate: () => vi.fn(),
}))

describe("image detail loading state", () => {
  it("shows the image detail skeleton on first paint", () => {
    const html = renderToString(
      <FramebookApp
        routeScreen="image-detail"
        routeTopicId="topic-1"
        routeImageId="image-1"
      />
    )

    expect(html).toContain("Loading image detail")
    expect(html).not.toContain("Image generation prompt")
  })
})
