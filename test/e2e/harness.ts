import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { createReadStream, existsSync, mkdtempSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'

export const ROOT = join(__dirname, '..', '..')
const FIXTURES = join(ROOT, 'test', 'fixtures')

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain' }

/** Serves test/fixtures; two of these on different ports give a cross-origin iframe. */
export function serveFixtures(): Promise<{ url: string; close: () => void }> {
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    const file = normalize(join(FIXTURES, path))
    if (!file.startsWith(FIXTURES) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  )
}

export async function launch(): Promise<{ app: ElectronApplication; win: Page; userData: string }> {
  const userData = mkdtempSync(join(tmpdir(), 'tesla-emu-'))
  const args = ['.']
  if (process.platform === 'linux') args.push('--no-sandbox')
  // E2E_DISABLE_GPU=1 reproduces GPU-less CI runners (no WebGL) locally.
  if (process.env.E2E_DISABLE_GPU) args.push('--disable-gpu')
  const app = await electron.launch({
    args,
    cwd: ROOT,
    env: { ...process.env, TESLA_EMU_USER_DATA: userData, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
  })
  const win = await app.firstWindow()
  // Surface renderer problems in the test log (CI has no other view of them).
  win.on('console', (m) => {
    if (m.type() === 'error') console.log('[ui:error]', m.text().slice(0, 500))
  })
  win.on('pageerror', (e) => console.log('[ui:pageerror]', e.message))
  await win.waitForSelector('[data-testid=webview]')
  await expect.poll(() => app.evaluate(() => !!globalThis.__teslaEmulator?.guestContents()), { timeout: 30_000 }).toBe(true)
  return { app, win, userData }
}

declare global {
  // eslint-disable-next-line no-var
  var __teslaEmulator: {
    setGear: (g: string) => void
    vehicle: () => { gear: string }
    guestContents: () => Electron.WebContents | null
    probeUrl: () => string
    events: () => { kind: string; detail: string }[]
    layout: () => { width: number; height: number } | null
  }
}

/** Navigate through the browser's address bar, then wait for the load to finish. */
export async function navigate(app: ElectronApplication, win: Page, url: string): Promise<void> {
  await win.fill('[data-testid=url-input]', url)
  await win.press('[data-testid=url-input]', 'Enter')
  await expect
    .poll(() =>
      app.evaluate((_e, target) => {
        const g = globalThis.__teslaEmulator.guestContents()
        return !!g && g.getURL().startsWith(target) && !g.isLoading()
      }, url),
      { timeout: 30_000 }
    )
    .toBe(true)
}

export function guestEval<T = unknown>(app: ElectronApplication, code: string, userGesture = false): Promise<T> {
  return app.evaluate(
    (_e, [c, gesture]) => globalThis.__teslaEmulator.guestContents()!.executeJavaScript(c as string, gesture as boolean),
    [code, userGesture] as const
  ) as Promise<T>
}

/** Run code in the first frame whose URL contains `urlPart` (e.g. a cross-origin iframe). */
export function frameEval<T = unknown>(app: ElectronApplication, urlPart: string, code: string, userGesture = false): Promise<T> {
  return app.evaluate(
    async (_e, [part, c, gesture]) => {
      const g = globalThis.__teslaEmulator.guestContents()!
      const frame = g.mainFrame.framesInSubtree.find((f) => f !== g.mainFrame && f.url.includes(part as string))
      if (!frame) throw new Error('frame not found: ' + part)
      return frame.executeJavaScript(c as string, gesture as boolean)
    },
    [urlPart, code, userGesture] as const
  ) as Promise<T>
}

export function setGear(app: ElectronApplication, gear: 'P' | 'R' | 'N' | 'D'): Promise<void> {
  return app.evaluate((_e, g) => globalThis.__teslaEmulator.setGear(g), gear)
}

/** Size of the guest's rendered output, retrying until its surface is ready to capture. */
export async function captureSize(app: ElectronApplication): Promise<{ width: number; height: number }> {
  return app.evaluate(async () => {
    const g = globalThis.__teslaEmulator.guestContents()!
    for (let i = 0; ; i++) {
      try {
        return (await g.capturePage()).getSize()
      } catch (err) {
        if (i > 30) throw err
        await new Promise((r) => setTimeout(r, 100))
      }
    }
  })
}

/** Fingerprint of a region of the rendered page (CSS px of the guest viewport). */
export function regionHash(
  app: ElectronApplication,
  rect: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return app.evaluate(async (_e, r) => {
    const g = globalThis.__teslaEmulator.guestContents()!
    let img: Electron.NativeImage | null = null
    for (let i = 0; !img; i++) {
      try {
        img = await g.capturePage()
      } catch (err) {
        if (i > 30) throw err
        await new Promise((res) => setTimeout(res, 100))
      }
    }
    const inner = (await g.executeJavaScript('innerWidth')) as number
    const k = img.getSize().width / inner
    const crop = img.crop({
      x: Math.round((r.x + 4) * k),
      y: Math.round((r.y + 4) * k),
      width: Math.round((r.width - 8) * k),
      height: Math.round((r.height - 8) * k)
    })
    const bmp = crop.toBitmap()
    let h = 2166136261
    for (let i = 0; i < bmp.length; i += 7) h = Math.imul(h ^ bmp[i], 16777619) >>> 0
    return `${crop.getSize().width}x${crop.getSize().height}:${h}`
  }, rect)
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
