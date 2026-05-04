import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { defaultThemeMode, themeStorageKey } from "../app/lib/theme"
import appCss from "../app/styles/index.css?url"

const themeBootstrapScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem(${JSON.stringify(themeStorageKey)});
    const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : ${JSON.stringify(defaultThemeMode)};
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  } catch (storageError) {
    document.documentElement.classList.add(${JSON.stringify(defaultThemeMode)});
  }
})();
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Framebook",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex min-h-svh max-w-5xl items-center px-6 py-20">
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-sm ring-1 ring-white/5">
        <p className="text-xs font-medium tracking-[0.24em] text-muted-foreground uppercase">
          404
        </p>
        <h1 className="mt-3 font-heading text-5xl tracking-[-0.06em] text-foreground">
          Page not found.
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          The requested page could not be found.
        </p>
      </div>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
