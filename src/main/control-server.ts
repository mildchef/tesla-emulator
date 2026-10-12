import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

/** Port tried first; any free port is used when it is taken (e.g. by a second instance). */
const PREFERRED_PORT = 47174
const MAX_BODY = 1024 * 1024

export interface ControlResult {
  status?: number
  json?: unknown
  png?: Buffer
}
export type ControlRoute = (body: Record<string, unknown>, query: URLSearchParams) => Promise<ControlResult> | ControlResult

/**
 * A local HTTP API for driving the emulator from scripts and coding agents
 * (the tesla-web-dev skill's `emu` CLI in packages/tesla-web-dev). It listens on 127.0.0.1 only, and
 * every request needs the bearer token from `control.json` in the userData
 * folder, which also records the port. Requests that carry an Origin header,
 * i.e. that come from a web page such as the one under test, are refused.
 */
export async function startControlServer(routes: Record<string, ControlRoute>): Promise<void> {
  const token = randomBytes(24).toString('hex')
  const server = createServer((req, res) => void handle(req, res))

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.headers.origin) return send(res, 403, { error: 'Requests from web pages are not allowed' })
    if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: 'Missing or wrong token' })
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const route = routes[`${req.method} ${url.pathname}`]
    if (!route) return send(res, 404, { error: `Unknown endpoint: ${req.method} ${url.pathname}` })
    try {
      const body = req.method === 'POST' ? await readJson(req) : {}
      const result = await route(body, url.searchParams)
      if (result.png) {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': result.png.length })
        res.end(result.png)
        return
      }
      send(res, result.status ?? 200, result.json ?? { ok: true })
    } catch (err) {
      send(res, 500, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  const port = await listen(server, PREFERRED_PORT).catch(() => listen(server, 0))
  const file = join(app.getPath('userData'), 'control.json')
  writeFileSync(file, JSON.stringify({ port, token, pid: process.pid }, null, 2) + '\n', { mode: 0o600 })
  app.on('will-quit', () => {
    server.close()
    try {
      // Another instance sharing this folder may have replaced the file since.
      if ((JSON.parse(readFileSync(file, 'utf8')) as { token?: string }).token === token) rmSync(file)
    } catch {
      // already gone
    }
  })
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error): void => {
      server.off('listening', onListening)
      reject(err)
    }
    const onListening = (): void => {
      server.off('error', onError)
      resolve((server.address() as AddressInfo).port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) return resolve({})
      try {
        const value: unknown = JSON.parse(text)
        resolve(value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {})
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, json: unknown): void {
  const body = JSON.stringify(json)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}
