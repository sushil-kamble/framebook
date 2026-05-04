import { cn } from "@shared/lib/utils"

export type AppBreadcrumbItem = {
  label: string
  onClick?: () => void
}

export function AppBreadcrumb({ items }: { items: Array<AppBreadcrumbItem> }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-baseline gap-2"
            >
              {index > 0 ? (
                <span className="text-base text-muted-foreground/35">/</span>
              ) : null}
              <BreadcrumbPart item={item} isCurrent={isLast} />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function BreadcrumbPart({
  item,
  isCurrent,
}: {
  item: AppBreadcrumbItem
  isCurrent: boolean
}) {
  const className = cn(
    "max-w-full min-w-0 truncate transition-colors",
    isCurrent
      ? "font-heading text-3xl font-bold tracking-tight text-foreground"
      : "text-sm font-medium text-muted-foreground/60",
    item.onClick
      ? "cursor-pointer hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
      : ""
  )

  if (item.onClick) {
    return (
      <button type="button" className={className} onClick={item.onClick}>
        {item.label}
      </button>
    )
  }

  return (
    <span className={className} aria-current={isCurrent ? "page" : undefined}>
      {item.label}
    </span>
  )
}
