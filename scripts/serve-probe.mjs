#!/usr/bin/env node
/**
 * Serves the browser probe on your local network so you can open it in the car
 * (car and computer on the same Wi-Fi), then compare its numbers with the
 * emulator's: npm run probe:lan
 */
import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'probe', 'index.html')
const PORT = Number(process.env.PORT ?? 47801)

if (!existsSync(FILE)) {
  console.error('probe page missing:', FILE)
  process.exit(1)
}

createServer((req, res) => {
  if (req.url !== '/' && !req.url?.startsWith('/?')) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  createReadStream(FILE).pipe(res)
}).listen(PORT, '0.0.0.0', () => {
  const addrs = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a.address}:${PORT}/`)
  console.log('Open one of these in the car browser:')
  for (const a of addrs) console.log('  ' + a)
  console.log('Ctrl+C to stop.')
})
