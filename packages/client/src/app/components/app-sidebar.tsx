import {
  ChevronDown,
  FolderOpen,
  Monitor,
  Moon,
  Plus,
  Settings,
  Star,
  Sun,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@shared/lib/utils"
import { formatRelativeTime } from "../lib/utils"
import type { ReactNode } from "react"
import type { ThemeMode } from "../lib/theme"
import type { Screen } from "../lib/types"
import type { TopicSummary } from "@framebook/shared/contracts/framebook"

const initialTopicCount = 6
const topicLoadStep = 10

export function Sidebar({
  screen,
  themeMode,
  topics,
  activeTopicId,
  onNavigate,
  onSelectTopic,
  onCreateTopic,
  onThemeModeChange,
}: {
  screen: Screen
  themeMode: ThemeMode
  topics: Array<TopicSummary>
  activeTopicId: string | null
  onNavigate: (screen: Screen) => void
  onSelectTopic: (topic: TopicSummary) => void
  onCreateTopic: () => void
  onThemeModeChange: (themeMode: ThemeMode) => void
}) {
  const [visibleTopicCount, setVisibleTopicCount] = useState(initialTopicCount)

  const sortedTopics = useMemo(() => {
    const recencyKey = (topic: TopicSummary) =>
      topic.latestImageCreatedAt ?? topic.updatedAt
    return [...topics].sort((left, right) =>
      recencyKey(right).localeCompare(recencyKey(left))
    )
  }, [topics])

  useEffect(() => {
    if (visibleTopicCount > sortedTopics.length) {
      setVisibleTopicCount(Math.max(initialTopicCount, sortedTopics.length))
    }
  }, [sortedTopics.length, visibleTopicCount])

  const visibleTopics = sortedTopics.slice(0, visibleTopicCount)
  const remainingTopicCount = sortedTopics.length - visibleTopics.length

  return (
    <aside className="sidebar-shell sticky top-0 hidden h-svh max-h-svh w-58 shrink-0 flex-col overflow-hidden md:flex">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <div className="sidebar-brand-mark relative grid size-8 shrink-0 place-items-center">
            <img
              src="/assets/framebook-logo.png"
              alt=""
              className="size-8"
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="font-heading text-sm font-semibold tracking-tight text-foreground">
              Framebook
            </div>
            <div className="text-[10px] tracking-widest text-muted-foreground/60 uppercase">
              Image Studio
            </div>
          </div>
        </div>

        <div className="sidebar-scroll-area flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-2 pb-3">
          <button
            type="button"
            className="sidebar-cta flex h-9 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white transition-all duration-150"
            onClick={onCreateTopic}
          >
            <Plus className="size-3.5" />
            New Topic
          </button>

          <section className="flex flex-col gap-1">
            <NavButton
              active={screen === "topics" || screen === "topic-editor"}
              icon={<FolderOpen className="size-3.5" />}
              label="Topics"
              trailing={
                sortedTopics.length > 0 ? (
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">
                    {sortedTopics.length}
                  </span>
                ) : null
              }
              onClick={() => onNavigate("topics")}
            />

            {sortedTopics.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground/60">
                No topics yet. Create one to get started.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {visibleTopics.map((topic) => (
                  <li key={topic.id}>
                    <TopicItem
                      topic={topic}
                      active={
                        (screen === "topic" || screen === "image-detail") &&
                        activeTopicId === topic.id
                      }
                      onClick={() => onSelectTopic(topic)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {remainingTopicCount > 0 ? (
              <button
                type="button"
                className="sidebar-show-more mt-1 flex h-8 items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium text-muted-foreground transition-all duration-150"
                onClick={() =>
                  setVisibleTopicCount((current) => current + topicLoadStep)
                }
              >
                Load {Math.min(remainingTopicCount, topicLoadStep)} more
                <ChevronDown className="size-3.5" />
              </button>
            ) : null}
          </section>

          <nav className="mt-1 flex flex-col gap-0.5">
            <NavButton
              active={screen === "starred" || screen === "gallery"}
              icon={<Star className="size-3.5" />}
              label="Starred"
              onClick={() => onNavigate("starred")}
            />
            <NavButton
              active={screen === "settings"}
              icon={<Settings className="size-3.5" />}
              label="Settings"
              onClick={() => onNavigate("settings")}
            />
          </nav>
        </div>

        <div className="flex flex-col gap-2 px-3 pt-2 pb-4">
          <div className="sidebar-theme-pill rounded-2xl p-1.5 text-xs">
            <div className="grid grid-cols-2 gap-1">
              <ThemeButton
                active={themeMode === "light"}
                icon={<Sun className="size-3.5" />}
                label="Light"
                onClick={() => onThemeModeChange("light")}
              />
              <ThemeButton
                active={themeMode === "dark"}
                icon={<Moon className="size-3.5" />}
                label="Dark"
                onClick={() => onThemeModeChange("dark")}
              />
            </div>
          </div>

          <div className="sidebar-info-card flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-muted-foreground">
            <Monitor className="size-3.5 shrink-0 text-ring" />
            <span className="truncate">Local-first &middot; on this device</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function NavButton({
  active,
  icon,
  label,
  trailing,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  trailing?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(
        "sidebar-nav-btn relative flex h-9 items-center gap-2.5 rounded-2xl px-3 text-sm transition-all duration-150",
        active
          ? "sidebar-nav-btn-active font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
    >
      {active && <span className="sidebar-nav-indicator" />}
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  )
}

function TopicItem({
  topic,
  active,
  onClick,
}: {
  topic: TopicSummary
  active: boolean
  onClick: () => void
}) {
  const recencySource = topic.latestImageCreatedAt ?? topic.updatedAt
  const relativeLabel = formatRelativeTime(recencySource)

  return (
    <button
      type="button"
      title={topic.name}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "sidebar-topic-btn relative flex h-9 w-full items-center gap-2 rounded-xl pr-2.5 pl-3 text-sm transition-all duration-150",
        active
          ? "sidebar-topic-btn-active font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {active && <span className="sidebar-nav-indicator" />}
      <span className="flex-1 truncate text-left">{topic.name}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/55">
        {relativeLabel}
      </span>
    </button>
  )
}

function ThemeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-theme-mode={label.toLowerCase()}
      className={cn(
        "framebook-theme-button flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-medium transition-all"
      )}
      aria-pressed={active}
      title={`${label} mode`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
