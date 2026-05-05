export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    'content-type': 'application/json',
  })
  response.end(JSON.stringify(body))
}

export function sendNoContent(response, statusCode = 204) {
  response.writeHead(statusCode, corsHeaders())
  response.end()
}

export function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
}

export async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim()

  if (!rawBody) {
    return {}
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    const error = new Error('Invalid JSON body')
    error.statusCode = 400
    throw error
  }
}
