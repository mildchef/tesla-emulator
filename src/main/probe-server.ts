import { app } from 'electron'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
}

/** Serves a directory read-only on 127.0.0.1. */
export function serveDirectory(root: string, port: number): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    let file = normalize(join(root, pathname))
    if (!file.startsWith(root + sep) && file !== root) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => {
    const listen = (p: number): void => {
      server.once('error', () => listen(0))
      server.listen(p, '127.0.0.1', () => {
        const address = server.address()
        const actual = typeof address === 'object' && address ? address.port : p
        resolve({ server, url: `http://127.0.0.1:${actual}/` })
      })
    }
    listen(port)
  })
}

/** The probe page reports what the browser exposes; open it in the car to compare. */
export async function startProbeServer(): Promise<string> {
  const root = join(app.getAppPath(), 'resources', 'probe')
  const { url } = await serveDirectory(root, 47800)
  return url
}
