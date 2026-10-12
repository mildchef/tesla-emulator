import type { BrowserWindow, WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import { getProfile } from '../shared/profiles'
import type { BrowserLayout, Gear, GuardrailEvent, Settings, VehicleState } from '../shared/types'
import { toUrl } from '../shared/url'
import type { ControlRoute } from './control-server'
import { currentUserAgent, type BrowserGuest } from './guest-session'
import { store } from './store'

export interface ControlContext {
  window: () => BrowserWindow | null
  guest: () => BrowserGuest | null
  vehicle: () => VehicleState
  setGear: (gear: Gear) => void
  events: () => GuardrailEvent[]
  applySettings: (patch: Partial<Settings>) => Settings
  sendUI: (channel: string, ...args: unknown[]) => void
  probeUrl: () => string
  quit: () => void
}

interface ConsoleEntry {
  seq: number
  time: number
  level: string
  message: string
  source: string
  line: number
}

const CONSOLE_LIMIT = 500
const consoleLog: ConsoleEntry[] = []
let consoleSeq = 0

function logConsole(level: string, message: string, source = '', line = 0): void {
  consoleLog.push({ seq: ++consoleSeq, time: Date.now(), level, message: message.slice(0, 4000), source, line })
  if (consoleLog.length > CONSOLE_LIMIT) consoleLog.shift()
}

/** Records the page's console output, failed loads and crashes for `GET /console`. */
export function trackConsole(contents: WebContents): void {
  contents.on('console-message', (event: unknown, details?: unknown) => {
    // Electron 42 puts the details on the event (and still passes the old positional
    // arguments after it); some versions pass them as an object in second place.
    const d = (typeof (event as { message?: unknown }).message === 'string' ? event : details) as {
      level?: number | string
      message?: string
      lineNumber?: number
      sourceId?: string
    }
    const level = typeof d.level === 'number' ? (['debug', 'info', 'warning', 'error'][d.level] ?? 'info') : (d.level ?? 'info')
    logConsole(level, String(d.message ?? ''), d.sourceId ?? '', d.lineNumber ?? 0)
  })
  contents.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    // -3 is ERR_ABORTED: a navigation replaced by another one.
    if (isMainFrame && code !== -3) logConsole('error', `Failed to load ${url}: ${description} (${code})`, url)
  })
  contents.on('render-process-gone', (_e, details) => logConsole('error', `The page crashed (${details.reason})`))
}

const GEARS: Gear[] = ['P', 'R', 'N', 'D']

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(timer)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    )
  })
}

/** Resolves once a navigation that starts after this call has finished (or failed). */
function waitForLoad(contents: WebContents, ms: number): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    let started = false
    let failure: string | undefined
    const onStart = (): void => {
      started = true
    }
    const onFail = (_e: unknown, code: number, description: string, url: string, isMainFrame: boolean): void => {
      if (isMainFrame && code !== -3) failure = `${description} (${code}) loading ${url}`
    }
    const onStop = (): void => {
      if (started) finish()
    }
    const onInPage = (_e: unknown, _url: string, isMainFrame: boolean): void => {
      if (isMainFrame) finish()
    }
    const timer = setTimeout(() => finish(`no load finished within ${ms} ms`), ms)
    function finish(timeout?: string): void {
      clearTimeout(timer)
      contents.off('did-start-loading', onStart)
      contents.off('did-fail-load', onFail)
      contents.off('did-stop-loading', onStop)
      contents.off('did-navigate-in-page', onInPage)
      const error = failure ?? timeout
      resolve(error ? { ok: false, error } : { ok: true })
    }
    contents.on('did-start-loading', onStart)
    contents.on('did-fail-load', onFail)
    contents.on('did-stop-loading', onStop)
    contents.on('did-navigate-in-page', onInPage)
  })
}

/** Captures a WebContents, retrying while its surface is not ready yet. */
async function capture(contents: WebContents, rect?: Electron.Rectangle): Promise<Electron.NativeImage> {
  for (let i = 0; ; i++) {
    try {
      const img = rect ? await contents.capturePage(rect) : await contents.capturePage()
      if (!img.isEmpty()) return img
    } catch (err) {
      if (i >= 30) throw err
    }
    if (i >= 30) throw new Error('Nothing to capture: is the emulator window minimized?')
    await sleep(100)
  }
}

function num(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** The endpoints behind the tesla-web-dev skill's `emu` CLI (packages/tesla-web-dev). */
export function controlRoutes(ctx: ControlContext): Record<string, ControlRoute> {
  const requireGuest = (): BrowserGuest => {
    const g = ctx.guest()
    if (!g || g.contents.isDestroyed()) throw new Error('The browser is not ready yet')
    return g
  }

  const pageInfo = (g: BrowserGuest | null): unknown =>
    g && !g.contents.isDestroyed()
      ? { url: g.contents.getURL(), title: g.contents.getTitle(), loading: g.contents.isLoading() }
      : null

  const status = (): unknown => {
    const g = ctx.guest()
    const s = store().settings
    const profile = getProfile(s.profileId)
    const v = ctx.vehicle()
    return {
      pid: process.pid,
      chrome: process.versions.chrome,
      gear: v.gear,
      parked: v.gear === 'P',
      layout: g?.currentLayout ?? null,
      viewport: g?.emulation.viewport ?? null,
      devicePixelRatio: profile.devicePixelRatio,
      screen: profile.screen,
      profile: profile.id,
      theme: s.theme,
      touchInput: s.touchInput,
      muted: s.muted,
      userAgent: currentUserAgent(process.versions.chrome),
      probeUrl: ctx.probeUrl(),
      page: pageInfo(g)
    }
  }

  const loadThen = async (body: Record<string, unknown>, start: (g: BrowserGuest) => void): Promise<{ json: unknown }> => {
    const g = requireGuest()
    const done = waitForLoad(g.contents, num(body.timeoutMs, 30_000))
    start(g)
    const result = await done
    return { json: { ...result, page: pageInfo(g) } }
  }

  return {
    'GET /status': () => ({ json: status() }),

    'POST /navigate': (body) => {
      const url = toUrl(String(body.url ?? ''))
      if (!url) throw new Error('Pass the address to open as "url"')
      // Through the UI, exactly as if it had been typed in the address bar.
      return loadThen(body, () => ctx.sendUI(IPC.guestNavigate, url))
    },
    'POST /reload': (body) => loadThen(body, (g) => g.contents.reload()),
    'POST /back': (body) =>
      loadThen(body, (g) => {
        if (!g.contents.navigationHistory.canGoBack()) throw new Error('Nothing to go back to')
        g.contents.navigationHistory.goBack()
      }),
    'POST /forward': (body) =>
      loadThen(body, (g) => {
        if (!g.contents.navigationHistory.canGoForward()) throw new Error('Nothing to go forward to')
        g.contents.navigationHistory.goForward()
      }),

    'POST /gear': async (body) => {
      const gear = String(body.gear ?? '').toUpperCase() as Gear
      if (!GEARS.includes(gear)) throw new Error('Gear must be one of P, R, N, D')
      ctx.setGear(gear)
      // Give every frame's guardrails a moment to apply (videos freeze, fullscreen exits).
      await sleep(300)
      return { json: status() }
    },

    'POST /layout': async (body) => {
      const layout = String(body.layout ?? '') as BrowserLayout
      if (layout !== 'split' && layout !== 'expanded') throw new Error('Layout must be "split" or "expanded"')
      const g = requireGuest()
      ctx.sendUI(IPC.setLayout, layout)
      for (let i = 0; i < 20 && g.currentLayout !== layout; i++) await sleep(50)
      await sleep(300) // let the page re-lay out at the new size
      const json = status() as Record<string, unknown>
      if (g.currentLayout !== layout) json.note = 'The expanded browser is only available in Park'
      return { json }
    },

    'GET /screenshot': async (_body, query) => {
      const target = query.get('target') ?? 'page'
      if (target === 'page') return { png: (await capture(requireGuest().contents)).toPNG() }
      if (target !== 'screen') throw new Error('Target must be "page" or "screen"')
      const ui = ctx.window()?.webContents
      if (!ui) throw new Error('The emulator window is not open')
      const rect = (await ui.executeJavaScript(
        `(() => { const r = document.querySelector('[data-testid=tesla-screen]')?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null })()`
      )) as Electron.Rectangle | null
      const round = rect && { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
      return { png: (await capture(ui, round ?? undefined)).toPNG() }
    },

    'POST /eval': async (body) => {
      const code = String(body.code ?? '')
      if (!code.trim()) throw new Error('Pass the JavaScript to run as "code"')
      try {
        const result: unknown = await withTimeout(requireGuest().contents.executeJavaScript(code, true), num(body.timeoutMs, 15_000), 'Script')
        return { json: { ok: true, result: result === undefined ? null : result } }
      } catch (err) {
        return { json: { ok: false, error: err instanceof Error ? err.message : String(err) } }
      }
    },

    'GET /console': (_body, query) => {
      const since = Number(query.get('since') ?? 0)
      const levels = query.get('level')?.split(',')
      const entries = consoleLog.filter((e) => e.seq > since && (!levels || levels.includes(e.level)))
      return { json: { next: consoleSeq, entries } }
    },
    'POST /console/clear': () => {
      consoleLog.length = 0
      return { json: { next: consoleSeq } }
    },

    'GET /events': (_body, query) => {
      const since = Number(query.get('since') ?? 0)
      return { json: { events: ctx.events().filter((e) => e.time > since) } }
    },

    'POST /settings': (body) => {
      const patch: Partial<Settings> = {}
      if (body.theme === 'dark' || body.theme === 'light') patch.theme = body.theme
      if (typeof body.profileId === 'string') patch.profileId = body.profileId
      if (typeof body.userAgentOverride === 'string') patch.userAgentOverride = body.userAgentOverride
      if (typeof body.touchInput === 'boolean') patch.touchInput = body.touchInput
      if (typeof body.muted === 'boolean') patch.muted = body.muted
      if (!Object.keys(patch).length) throw new Error('Nothing to change: pass theme, profileId, userAgentOverride, touchInput or muted')
      ctx.applySettings(patch)
      return { json: status() }
    },

    'POST /devtools': () => {
      requireGuest().contents.openDevTools({ mode: 'detach' })
      return { json: { ok: true } }
    },

    'POST /quit': () => {
      setTimeout(ctx.quit, 100)
      return { json: { ok: true } }
    }
  }
}
