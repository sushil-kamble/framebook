import {
  Check,
  FolderOpen,
  Grid2X2,
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
import { Button } from "@/shared/ui/button"

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
    <aside className="hidden min-h-svh w-58 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
      <div className="mb-5 flex items-center gap-2.5 px-2 py-1">
        <div className="relative grid size-8 shrink-0 place-items-center rounded-xl framer-spotlight-violet shadow-md shadow-black/30">
          <Grid2X2 className="size-3.5 text-white" />
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

      <div className="mb-1.5 px-3">
        <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase">
          Workspace
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavButton
          active={
            screen === "topics" ||
            screen === "topic" ||
            screen === "topic-editor"
          }
          icon={<FolderOpen className="size-3.5" />}
          label="Topics"
          onClick={() => onNavigate("topics")}
        />
        <NavButton
          active={screen === "starred" || screen === "image-detail"}
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

      <Button
        type="button"
        size="sm"
        className="mt-4 justify-center text-xs"
        onClick={onCreateTopic}
      >
        <Plus className="size-3.5" />
        New Topic
      </Button>

      <div className="mt-auto flex flex-col gap-2">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-3 text-xs shadow-sm ring-1 ring-white/5">
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

        <div className="rounded-2xl border border-border/70 bg-card/70 p-1.5 text-xs shadow-sm ring-1 ring-white/5">
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
        "relative flex h-10 items-center gap-2.5 rounded-2xl px-3 text-sm transition-all duration-150",
        active
          ? "border border-ring/20 bg-ring/10 font-semibold text-foreground shadow-[0_0_0_1px_rgba(0,153,255,0.12)]"
          : "font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
    >
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
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
