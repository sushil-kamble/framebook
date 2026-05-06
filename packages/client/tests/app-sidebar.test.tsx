import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Sidebar } from "../src/app/components/app-sidebar"
import type { TopicSummary } from "@framebook/shared/contracts/framebook"

const baseTopic = (overrides: Partial<TopicSummary> = {}): TopicSummary => ({
  id: "topic-1",
  name: "Topic One",
  description: "",
  instruction: "",
  defaultAspectRatio: "16:9",
  basePromptDetails: "",
  enhancerMode: "balanced",
  archivedAt: null,
  createdAt: "2026-04-01T10:00:00.000Z",
  updatedAt: "2026-04-01T10:00:00.000Z",
  imageCount: 0,
  favoriteCount: 0,
  latestImageId: null,
  latestImageCreatedAt: null,
  ...overrides,
})

describe("sidebar layout", () => {
  it("keeps sidebar controls pinned to the viewport height", () => {
    const { container } = render(
      <Sidebar
        screen="topics"
        themeMode="dark"
        topics={[]}
        activeTopicId={null}
        onNavigate={vi.fn()}
        onSelectTopic={vi.fn()}
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
    expect(container.querySelector(".sidebar-scroll-area")).toBeTruthy()
  })

  it("marks the Topics section header active for the topic editor screen", () => {
    const onNavigate = vi.fn()
    render(
      <Sidebar
        screen="topic-editor"
        themeMode="dark"
        topics={[]}
        activeTopicId={null}
        onNavigate={onNavigate}
        onSelectTopic={vi.fn()}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    const topicsHeader = screen.getByRole("button", { name: /Topics/u })
    expect(topicsHeader.getAttribute("aria-current")).toBe("page")

    fireEvent.click(topicsHeader)
    expect(onNavigate).toHaveBeenCalledWith("topics")

    expect(
      screen.getByRole("button", { name: "Starred" }).className
    ).not.toContain("sidebar-nav-btn-active")
  })

  it("renders New Topic above the topics section, then Starred and Settings below", () => {
    render(
      <Sidebar
        screen="topics"
        themeMode="dark"
        topics={[
          baseTopic({ id: "topic-1", name: "Alpha" }),
          baseTopic({ id: "topic-2", name: "Beta" }),
        ]}
        activeTopicId={null}
        onNavigate={vi.fn()}
        onSelectTopic={vi.fn()}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    const buttons = screen
      .getAllByRole("button")
      .map((node) => node.textContent.trim())
    const newTopicIndex = buttons.findIndex((label) => label === "New Topic")
    const topicsHeaderIndex = buttons.findIndex((label) =>
      label.startsWith("Topics")
    )
    const starredIndex = buttons.findIndex((label) => label === "Starred")
    const settingsIndex = buttons.findIndex((label) => label === "Settings")

    expect(newTopicIndex).toBeGreaterThan(-1)
    expect(newTopicIndex).toBeLessThan(topicsHeaderIndex)
    expect(topicsHeaderIndex).toBeLessThan(starredIndex)
    expect(starredIndex).toBeLessThan(settingsIndex)
  })
})

describe("sidebar topic list", () => {
  it("marks the active topic item when viewing that topic", () => {
    render(
      <Sidebar
        screen="topic"
        themeMode="dark"
        topics={[
          baseTopic({ id: "topic-1", name: "Alpha" }),
          baseTopic({ id: "topic-2", name: "Beta" }),
        ]}
        activeTopicId="topic-2"
        onNavigate={vi.fn()}
        onSelectTopic={vi.fn()}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    const activeTopic = screen.getByTitle("Beta")
    expect(activeTopic.className).toContain("sidebar-topic-btn-active")
    expect(activeTopic.getAttribute("aria-current")).toBe("page")

    const inactiveTopic = screen.getByTitle("Alpha")
    expect(inactiveTopic.className).not.toContain("sidebar-topic-btn-active")
  })

  it("invokes onSelectTopic when a topic item is clicked", () => {
    const onSelectTopic = vi.fn()
    const topic = baseTopic({ id: "topic-1", name: "Alpha" })

    render(
      <Sidebar
        screen="topics"
        themeMode="dark"
        topics={[topic]}
        activeTopicId={null}
        onNavigate={vi.fn()}
        onSelectTopic={onSelectTopic}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTitle("Alpha"))
    expect(onSelectTopic).toHaveBeenCalledWith(topic)
  })

  it("paginates topics with a Show more control", () => {
    const topics = Array.from({ length: 9 }, (_, index) =>
      baseTopic({
        id: `topic-${index}`,
        name: `Topic ${index}`,
        updatedAt: `2026-04-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
      })
    )

    render(
      <Sidebar
        screen="topics"
        themeMode="dark"
        topics={topics}
        activeTopicId={null}
        onNavigate={vi.fn()}
        onSelectTopic={vi.fn()}
        onCreateTopic={vi.fn()}
        onThemeModeChange={vi.fn()}
      />
    )

    expect(screen.getByTitle("Topic 0")).toBeTruthy()
    expect(screen.queryByTitle("Topic 6")).toBeNull()

    const showMore = screen.getByRole("button", { name: /Load 3 more/u })
    fireEvent.click(showMore)

    expect(screen.getByTitle("Topic 6")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Load .* more/u })).toBeNull()
  })
})
