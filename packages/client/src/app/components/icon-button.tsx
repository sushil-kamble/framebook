import type { ReactNode } from "react"

export function IconButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground transition hover:border-border hover:bg-accent hover:text-foreground"
      onClick={onClick}
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}
