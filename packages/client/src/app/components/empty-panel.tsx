import { Plus } from "lucide-react"
import { Button } from "@/shared/ui/button"

export function EmptyPanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-3xl border border-border/70 bg-card/40 p-8 text-center shadow-sm ring-1 ring-white/5">
      <div className="pointer-events-none absolute inset-0 framer-grid opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(212,77,240,0.18),transparent_28%),radial-gradient(circle_at_78%_28%,rgba(255,122,61,0.18),transparent_30%)]" />
      <div className="relative">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl framer-spotlight-violet text-white shadow-lg shadow-black/30">
          <Plus className="size-5" />
        </div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{body}</p>
        <Button type="button" size="sm" className="mt-5" onClick={onAction}>
          <Plus className="size-3.5" />
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
