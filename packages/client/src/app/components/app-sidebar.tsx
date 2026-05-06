import {
  Check,
  FolderOpen,
  Monitor,
  Moon,
  Plus,
  Settings,
  Star,
  Sun,
} from "lucide-react"
import { cn } from "@shared/lib/utils"
import type { ReactNode } from "react"
import type { ThemeMode } from "../lib/theme"
import type { Screen } from "../lib/types"

export function Sidebar({
  screen,
  themeMode,
  onNavigate,
  onCreateTopic,
  onThemeModeChange,
}: {
  screen: Screen
  themeMode: ThemeMode
  onNavigate: (screen: Screen) => void
  onCreateTopic: () => void
  onThemeModeChange: (themeMode: ThemeMode) => void
}) {
  return (
    <aside className="sidebar-shell sticky top-0 hidden h-svh max-h-svh w-58 shrink-0 flex-col overflow-hidden md:flex">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-5 flex items-center gap-2.5 px-2 py-1">
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


        <nav className="flex flex-col gap-0.5">
          <NavButton
            active={
              screen === "topics" ||
              screen === "topic" ||
              screen === "topic-editor" ||
              screen === "image-detail"
            }
            icon={<FolderOpen className="size-3.5" />}
            label="Topics"
            onClick={() => onNavigate("topics")}
          />
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

        <button
          type="button"
          className="sidebar-cta mt-4 flex h-9 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white transition-all duration-150"
          onClick={onCreateTopic}
        >
          <Plus className="size-3.5" />
          New Topic
        </button>

        <div className="mt-auto flex flex-col gap-2">
          <div className="sidebar-info-card rounded-2xl p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 font-semibold text-foreground/70">
              <Monitor className="size-3.5 text-ring" />
              Local-first
            </div>
            <div className="space-y-1.5 text-muted-foreground">
              <div className="flex gap-2">
                <Check className="mt-px size-3.5 shrink-0 text-ring" />
                <span>Everything saved on this device</span>
              </div>
              <div className="flex gap-2">
                <Check className="mt-px size-3.5 shrink-0 text-ring" />
                <span>Images stay in your workspace</span>
              </div>
            </div>
          </div>

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
        </div>
      </div>
    </aside>
  )
}

function NavButton({
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
      className={cn(
        "sidebar-nav-btn relative flex h-10 items-center gap-2.5 rounded-2xl px-3 text-sm transition-all duration-150",
        active
          ? "sidebar-nav-btn-active font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
    >
      {active && <span className="sidebar-nav-indicator" />}
      {icon}
      {label}
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
