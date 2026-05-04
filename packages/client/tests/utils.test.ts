import { afterEach, describe, expect, it, vi } from "vitest"
import {
  formatDate,
  formatViewerTimestamp,
  routeStateFromPathname,
} from "../src/app/lib/utils"

describe("timestamp formatters", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("formats compact timestamps in the viewer local timezone", () => {
    const dateSpy = vi
      .spyOn(Date.prototype, "toLocaleDateString")
      .mockReturnValue("May 4, 03:30 PM")

    expect(formatDate("2026-05-04T10:00:00.000Z")).toBe("May 4, 03:30 PM")
    expect(dateSpy).toHaveBeenCalledWith("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  })

  it("formats preview timestamps in the viewer local timezone", () => {
    const stringSpy = vi
      .spyOn(Date.prototype, "toLocaleString")
      .mockReturnValue("May 4, 03:30 PM")

    expect(formatViewerTimestamp("2026-05-04T10:00:00.000Z")).toBe(
      "May 4, 03:30 PM"
    )
    expect(stringSpy).toHaveBeenCalledWith("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  })
})

describe("route state parsing", () => {
  it("maps topic subpage paths to Framebook screens", () => {
    expect(routeStateFromPathname("/topics")).toEqual({
      routeScreen: "topics",
    })
    expect(routeStateFromPathname("/topics/topic%201")).toEqual({
      routeScreen: "topic",
      routeTopicId: "topic 1",
    })
    expect(
      routeStateFromPathname("/topics/topic%201/images/image%201")
    ).toEqual({
      routeScreen: "image-detail",
      routeTopicId: "topic 1",
      routeImageId: "image 1",
    })
  })
})
