export async function routeRequest(request, response) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')

  if (url.pathname === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'Not Found' }))
}
