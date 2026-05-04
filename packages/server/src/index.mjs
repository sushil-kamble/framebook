import { createHttpServer } from "./app/http-server.mjs"
import { closeFramebookService, getFramebookService } from "./app/router.mjs"

const port = Number.parseInt(process.env.PORT ?? "8787", 10)
const server = createHttpServer()
let shuttingDown = false

server.listen(port, "127.0.0.1", () => {
  getFramebookService()
  console.log(`Framebook server listening on http://127.0.0.1:${port}`)
})

server.on("close", () => {
  void closeFramebookService().catch((error) => {
    console.error(error)
  })
})

process.once("SIGINT", () => {
  shutdown()
})

process.once("SIGTERM", () => {
  shutdown()
})

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}
