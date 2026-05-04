import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Sidebar } from "../src/app/components/app-sidebar"

describe("sidebar active state", () => {
  it("keeps sidebar controls pinned to the viewport height", () => {
    const { container } = render(
      <Sidebar
        screen="topics"
        themeMode="dark"
        onNavigate={vi.fn()}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    expect(screen.getByRole("complementary").className).toContain("sticky")
    expect(screen.getByRole("complementary").className).toContain("h-svh")
    expect(screen.getByRole("complementary").className).toContain(
      "overflow-hidden"
    )
    expect(
      container.querySelector('img[src="/assets/framebook-logo.png"]')
    ).toBeTruthy()
  })

  it("marks Topics active for topic image detail routes", () => {
    render(
      <Sidebar
        screen="image-detail"
        themeMode="dark"
        onNavigate={vi.fn()}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Topics" }).className).toContain(
      "sidebar-nav-btn-active"
    )
    expect(
      screen.getByRole("button", { name: "Starred" }).className
    ).not.toContain("sidebar-nav-btn-active")
  })
})
