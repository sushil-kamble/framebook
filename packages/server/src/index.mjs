import { createHttpServer } from './app/http-server.mjs'

const port = Number.parseInt(process.env.PORT ?? '8787', 10)
const server = createHttpServer()

server.listen(port, '127.0.0.1', () => {
  console.log(`Framebook server listening on http://127.0.0.1:${port}`)
})
