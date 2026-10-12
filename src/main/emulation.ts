import type { WebContents } from 'electron'
import { BROWSER_BOX } from '../shared/layout'
import type { BrowserLayout, CarLocation, FirmwareProfile } from '../shared/types'

export interface EmulationConfig {
  profile: FirmwareProfile
  layout: BrowserLayout
  userAgent: string
  touch: boolean
  location: CarLocation
}

type Params = Record<string, unknown>

function viewportFor(profile: FirmwareProfile, layout: BrowserLayout): { width: number; height: number } {
  return layout === 'fullscreen' ? profile.screen : profile.viewport[layout]
}

/** Full version string for client hints, taken from the UA when it carries one. */
function fullVersionFromUA(ua: string, major: number): string {
  const m = ua.match(/(?:TeslaBrowser|Chrome)\/(\d+\.\d+\.\d+\.\d+)/g)
  const versions = (m ?? []).map((s) => s.split('/')[1]).filter((v) => !v.endsWith('.0.0.0'))
  return versions[0] ?? `${major}.0.0.0`
}

/**
 * Drives Chrome DevTools Protocol emulation for the browser guest: viewport size,
 * device pixel ratio, screen size, UA + client hints, color scheme, touch and the
 * car's GPS position. Out-of-process iframes (cross-site embeds) are auto-attached
 * so they get the per-frame overrides too.
 */
export class GuestEmulation {
  private readonly childSessions = new Set<string>()
  private config: EmulationConfig
  private started = false
  private reassertTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly guest: WebContents,
    config: EmulationConfig
  ) {
    this.config = config
  }

  async start(): Promise<void> {
    const dbg = this.guest.debugger
    if (!dbg.isAttached()) dbg.attach('1.3')
    dbg.on('message', (_event, method, params) => {
      if (method === 'Target.attachedToTarget') void this.onAttached(params as Params)
      if (method === 'Target.detachedFromTarget') this.childSessions.delete((params as Params).sessionId as string)
    })
    dbg.on('detach', (_event, reason) => {
      this.started = false
      console.warn('[emulation] debugger detached:', reason)
    })
    this.started = true
    await this.applyTopLevel()
    await this.applyPerTarget()
    await this.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true })
  }

  async update(patch: Partial<EmulationConfig>): Promise<void> {
    const prev = this.config
    this.config = { ...prev, ...patch }
    if (!this.started) return
    const topLevelChanged =
      prev.profile !== this.config.profile || prev.layout !== this.config.layout || prev.touch !== this.config.touch
    if (topLevelChanged) await this.applyTopLevel()
    if (patch.location && Object.keys(patch).length === 1) {
      await this.forAllTargets((sid) => this.applyGeolocation(sid))
      return
    }
    await this.applyPerTarget()
  }

  /**
   * Another DevTools client (Playwright, Puppeteer, DevTools' device toolbar)
   * can reset device emulation for every session. If the page reports metrics
   * that don't match the car's, put ours back.
   */
  verify(metrics: { innerWidth: number; innerHeight: number; devicePixelRatio: number }): void {
    if (!this.started) return
    const vp = this.viewport
    const ok =
      metrics.innerWidth === vp.width &&
      metrics.innerHeight === vp.height &&
      Math.abs(metrics.devicePixelRatio - this.config.profile.devicePixelRatio) < 0.01
    if (ok || this.reassertTimer) return
    this.reassertTimer = setTimeout(() => {
      this.reassertTimer = null
      void this.send('Emulation.clearDeviceMetricsOverride', {}).then(() => this.applyTopLevel())
    }, 250)
  }

  get viewport(): { width: number; height: number } {
    return viewportFor(this.config.profile, this.config.layout)
  }

  private async onAttached(params: Params): Promise<void> {
    const sessionId = params.sessionId as string
    const info = params.targetInfo as { type: string; url: string }
    try {
      if (info.type === 'iframe') {
        this.childSessions.add(sessionId)
        await this.applyTarget(sessionId)
        await this.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId)
      }
    } catch (err) {
      console.warn('[emulation] failed to configure child target', info.url, err)
    } finally {
      await this.send('Runtime.runIfWaitingForDebugger', {}, sessionId)
    }
  }

  /** Viewport, DPR, screen and input emulation live on the top-level page only. */
  private async applyTopLevel(): Promise<void> {
    const { profile, layout, touch } = this.config
    const vp = viewportFor(profile, layout)
    const box = BROWSER_BOX[layout]
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: profile.devicePixelRatio,
      mobile: false,
      // Draw the emulated viewport so it exactly fills the browser content box.
      scale: Math.min(box.width / vp.width, box.height / vp.height),
      screenWidth: profile.screen.width,
      screenHeight: profile.screen.height,
      positionX: 0,
      positionY: 0
    })
    const touchEnabled = touch || profile.pointer === 'coarse'
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: touchEnabled, maxTouchPoints: 10 })
    await this.send('Emulation.setEmitTouchEventsForMouse', { enabled: touchEnabled, configuration: 'mobile' })
  }

  private async applyPerTarget(): Promise<void> {
    await this.forAllTargets((sid) => this.applyTarget(sid))
  }

  private async applyTarget(sessionId?: string): Promise<void> {
    const { profile, userAgent } = this.config
    const major = String(profile.chromeMajor)
    const brands = [
      { brand: 'Chromium', version: major },
      { brand: 'Not/A)Brand', version: '24' }
    ]
    await this.send(
      'Emulation.setUserAgentOverride',
      {
        userAgent,
        acceptLanguage: 'en-US,en',
        platform: 'Linux x86_64',
        userAgentMetadata: {
          brands,
          fullVersionList: [
            { brand: 'Chromium', version: fullVersionFromUA(userAgent, profile.chromeMajor) },
            { brand: 'Not/A)Brand', version: '24.0.0.0' }
          ],
          platform: 'Linux',
          platformVersion: '',
          architecture: 'x86',
          model: '',
          mobile: false,
          bitness: '64',
          wow64: false
        }
      },
      sessionId
    )
    await this.send(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-color-scheme', value: profile.colorScheme }] },
      sessionId
    )
    await this.applyGeolocation(sessionId)
  }

  private async applyGeolocation(sessionId?: string): Promise<void> {
    const { lat, lng, accuracy } = this.config.location
    await this.send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy }, sessionId)
  }

  private async forAllTargets(fn: (sessionId?: string) => Promise<void>): Promise<void> {
    await fn(undefined)
    for (const sid of [...this.childSessions]) await fn(sid)
  }

  private async send(method: string, params: Params, sessionId?: string): Promise<unknown> {
    if (this.guest.isDestroyed()) return undefined
    try {
      return await this.guest.debugger.sendCommand(method, params, sessionId)
    } catch (err) {
      console.warn(`[emulation] ${method} failed`, (err as Error).message)
      return undefined
    }
  }
}
