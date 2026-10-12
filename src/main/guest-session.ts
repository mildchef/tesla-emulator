import { session, type Session, type WebContents } from 'electron'
import { getProfile, resolveUserAgent } from '../shared/profiles'
import type { BrowserLayout, GuardrailEvent, PermissionRequest } from '../shared/types'
import { GuestEmulation } from './emulation'
import { store } from './store'
import { vehicle } from './vehicle-state'
import { IPC } from '../shared/ipc'

export const GUEST_PARTITION = 'persist:tesla-browser'

export interface GuestHooks {
  emit: (event: GuardrailEvent) => void
  requestPermission: (req: PermissionRequest) => void
  historyChanged: () => void
  navigate: (url: string) => void
}

const ZOOM_KEYS = new Set(['=', '+', '-', '_', '0'])

let nextPermissionId = 1
const pendingPermissions = new Map<number, { callback: (granted: boolean) => void; video: boolean }>()

export function answerPermission(id: number, granted: boolean, hooks: GuestHooks): void {
  const pending = pendingPermissions.get(id)
  if (!pending) return
  pendingPermissions.delete(id)
  // The cabin camera is only available in Park; a prompt answered after shifting is refused.
  if (granted && pending.video && !vehicle.parked) {
    hooks.emit({ time: Date.now(), kind: 'camera', detail: 'Camera denied: shifted out of Park while the prompt was open' })
    pending.callback(false)
    return
  }
  pending.callback(granted)
}

export function currentUserAgent(chromeVersion: string): string {
  const s = store().settings
  return resolveUserAgent(getProfile(s.profileId), chromeVersion, s.userAgentOverride)
}

/** Session-wide behavior of the Tesla browser: UA, permissions, downloads, client hints. */
export function configureGuestSession(hooks: GuestHooks): Session {
  const ses = session.fromPartition(GUEST_PARTITION)
  const chromeVersion = process.versions.chrome
  ses.setUserAgent(currentUserAgent(chromeVersion), 'en-US,en')
  ses.setSpellCheckerEnabled(false)

  // Client hints must agree with the Linux UA, including for frames CDP hasn't reached yet.
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders
    const profile = getProfile(store().settings.profileId)
    for (const key of Object.keys(headers)) {
      const k = key.toLowerCase()
      if (k === 'sec-ch-ua-platform') headers[key] = '"Linux"'
      else if (k === 'sec-ch-ua-mobile') headers[key] = '?0'
      else if (k === 'sec-ch-ua') headers[key] = `"Chromium";v="${profile.chromeMajor}", "Not/A)Brand";v="24"`
    }
    callback({ requestHeaders: headers })
  })

  // The car browser cannot download files.
  ses.on('will-download', (event, item) => {
    event.preventDefault()
    hooks.emit({ time: Date.now(), kind: 'download', detail: `Download blocked: ${item.getFilename() || item.getURL()}` })
  })

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = safeOrigin(details.requestingUrl ?? wc.getURL())
    switch (permission) {
      case 'geolocation':
      case 'fullscreen':
      case 'clipboard-sanitized-write':
      case 'pointerLock':
      case 'speaker-selection':
      case 'storage-access':
      case 'top-level-storage-access':
        callback(true)
        return
      case 'media': {
        const types = (details as { mediaTypes?: string[] }).mediaTypes ?? []
        const video = types.includes('video')
        if (video && !vehicle.parked) {
          hooks.emit({ time: Date.now(), kind: 'camera', detail: `Camera blocked while not in Park (${origin})` })
          callback(false)
          return
        }
        const kinds = types.map((t) => (t === 'video' ? 'camera' : 'microphone'))
        const id = nextPermissionId++
        pendingPermissions.set(id, { callback, video })
        hooks.requestPermission({ id, origin, kinds: kinds.length ? kinds : ['microphone'] })
        return
      }
      default:
        hooks.emit({ time: Date.now(), kind: 'permission', detail: `Permission "${permission}" denied (${origin})` })
        callback(false)
    }
  })

  ses.setPermissionCheckHandler((_wc, permission) => {
    return ['geolocation', 'fullscreen', 'clipboard-sanitized-write', 'pointerLock'].includes(permission)
  })
  ses.setDevicePermissionHandler(() => false)
  ses.on('select-hid-device', (event, _details, callback) => {
    event.preventDefault()
    callback('')
  })
  ses.on('select-serial-port', (event, _ports, _wc, callback) => {
    event.preventDefault()
    callback('')
  })
  ses.on('select-usb-device', (event, _details, callback) => {
    event.preventDefault()
    callback()
  })

  return ses
}

export function updateSessionUserAgent(): void {
  session.fromPartition(GUEST_PARTITION).setUserAgent(currentUserAgent(process.versions.chrome), 'en-US,en')
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/** Wires one browser guest (the <webview> in the browser app). */
export class BrowserGuest {
  readonly emulation: GuestEmulation
  private layout: BrowserLayout = 'split'

  constructor(
    readonly contents: WebContents,
    private readonly hooks: GuestHooks
  ) {
    const s = store().settings
    this.emulation = new GuestEmulation(contents, {
      profile: getProfile(s.profileId),
      layout: this.layout,
      userAgent: currentUserAgent(process.versions.chrome),
      touch: s.touchInput,
      location: vehicle.get().location
    })

    contents.setAudioMuted(s.muted)
    void contents.setVisualZoomLevelLimits(1, 1)

    // Single-view browser: popups and target=_blank open in place.
    contents.setWindowOpenHandler(({ url }) => {
      if (url && url !== 'about:blank') {
        hooks.emit({ time: Date.now(), kind: 'popup', detail: `New window opened in the same view: ${url}` })
        hooks.navigate(url)
      }
      return { action: 'deny' }
    })

    // No page zoom in the car: Cmd/Ctrl +, -, 0 and Ctrl+wheel are swallowed.
    contents.on('before-input-event', (event, input) => {
      if ((input.meta || input.control) && ZOOM_KEYS.has(input.key)) {
        event.preventDefault()
        hooks.emit({ time: Date.now(), kind: 'zoom', detail: 'Page zoom is not available in the car browser' })
      }
    })
    contents.on('zoom-changed', () => contents.setZoomFactor(1))

    contents.on('did-navigate', (_e, url) => this.recordHistory(url))
    contents.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) this.recordHistory(url)
    })
    contents.on('page-title-updated', (_e, title) => {
      store().updateHistoryTitle(contents.getURL(), title)
      hooks.historyChanged()
    })
    contents.on('did-frame-finish-load', () => this.broadcastGear())

    void this.emulation.start()
  }

  get currentLayout(): BrowserLayout {
    return this.layout
  }

  setLayout(layout: BrowserLayout): void {
    this.layout = layout
    void this.emulation.update({ layout })
  }

  refreshSettings(): void {
    const s = store().settings
    this.contents.setAudioMuted(s.muted)
    void this.emulation.update({
      profile: getProfile(s.profileId),
      userAgent: currentUserAgent(process.versions.chrome),
      touch: s.touchInput
    })
  }

  /** Push the current gear to every frame's guest preload (incl. cross-site iframes). */
  broadcastGear(): void {
    if (this.contents.isDestroyed()) return
    const gear = vehicle.get().gear
    for (const frame of this.contents.mainFrame.framesInSubtree) {
      try {
        frame.send(IPC.guestGear, gear)
      } catch {
        // frame went away mid-iteration
      }
    }
  }

  private recordHistory(url: string): void {
    if (!url.startsWith('http')) return
    store().addHistory({ url, title: this.contents.getTitle() || url, time: Date.now() })
    this.hooks.historyChanged()
  }
}
