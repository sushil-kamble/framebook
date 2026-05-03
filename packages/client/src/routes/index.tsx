import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <main className="flex min-h-svh p-6">
      <section className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <h1 className="font-medium">Framebook scaffold ready</h1>
        <p>Client, server, and shared packages are in place.</p>
      </section>
    </main>
  )
}
