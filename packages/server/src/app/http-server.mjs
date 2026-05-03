import { createServer } from 'node:http'
import { routeRequest } from './router.mjs'

export function createHttpServer() {
  return createServer(async (request, response) => {
    try {
      await routeRequest(request, response)
    } catch (error) {
      console.error(error)
      response.writeHead(500, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'Internal Server Error' }))
    }
  })
}
