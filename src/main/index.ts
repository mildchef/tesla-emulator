import { app, BrowserWindow, ipcMain, Menu, net, protocol, screen, session, shell, type WebContents } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC } from '../shared/ipc'
import { PANEL } from '../shared/layout'
import { PROFILES } from '../shared/profiles'
import type { AppSnapshot, BrowserLayout, Gear, GuardrailEvent, GuestMetrics, Settings, VehicleState } from '../shared/types'
import {
  answerPermission,
  BrowserGuest,
  configureGuestSession,
  GUEST_PARTITION,
  updateSessionUserAgent,
  type GuestHooks
} from './guest-session'
import { useProjectDataDir } from './data-dir'
import { startProbeServer } from './probe-server'
import { store } from './store'
import { vehicle } from './vehicle-state'

app.setName('Tesla Emulator')
useProjectDataDir()

const GUEST_PRELOAD = join(__dirname, '../preload/guest.js')
const RENDERER_DIR = join(__dirname, '../renderer')

// The built UI is served from app:// rather than file:// so it can fetch() its
// own assets (the 3D model) like a normal web page.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const path = decodeURIComponent(new URL(request.url).pathname)
    const file = normalize(join(RENDERER_DIR, path === '/' ? 'index.html' : path))
    if (!file.startsWith(RENDERER_DIR + sep)) return new Response('Forbidden', { status: 403 })
    try {
      return await net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
const UI_PRELOAD = join(__dirname, '../preload/ui.js')

let win: BrowserWindow | null = null
let guest: BrowserGuest | null = null
let probeUrl = ''

function ui(): WebContents | null {
  return win && !win.isDestroyed() ? win.webContents : null
}

function sendUI(channel: string, ...args: unknown[]): void {
  ui()?.send(channel, ...args)
}

const recentEvents: GuardrailEvent[] = []

const hooks: GuestHooks = {
  emit: (event: GuardrailEvent) => {
    recentEvents.push(event)
    if (recentEvents.length > 200) recentEvents.shift()
    sendUI(IPC.guardrailEvent, event)
  },
  requestPermission: (req) => sendUI(IPC.permissionRequest, req),
  historyChanged: () => sendUI(IPC.historyChanged, store().history),
  navigate: (url) => sendUI(IPC.guestNavigate, url)
}

function snapshot(): AppSnapshot {
  return {
    vehicle: vehicle.get(),
    settings: store().settings,
    bookmarks: store().bookmarks,
    history: store().history,
    profiles: PROFILES,
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
    guestPreloadUrl: pathToFileURL(GUEST_PRELOAD).toString(),
    guestPartition: GUEST_PARTITION,
    homeUrl: probeUrl
  }
}

function initialWindowSize(): { width: number; height: number } {
  const area = screen.getPrimaryDisplay().workAreaSize
  const aspect = (PANEL.width + 120) / (PANEL.height + 120)
  let width = Math.min(1720, Math.round(area.width * 0.92))
  let height = Math.round(width / aspect)
  if (height > area.height * 0.92) {
    height = Math.round(area.height * 0.92)
    width = Math.round(height * aspect)
  }
  return { width, height }
}

function createWindow(): void {
  const { width, height } = initialWindowSize()
  win = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 540,
    backgroundColor: '#0d0d0f',
    title: 'Tesla Emulator',
    show: false,
    webPreferences: {
      preload: UI_PRELOAD,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      // HTML fullscreen inside the car browser must not take over the Mac window.
      disableHtmlFullscreenWindowResize: true
    }
  })

  win.once('ready-to-show', () => win?.show())

  win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (params.partition !== GUEST_PARTITION) {
      event.preventDefault()
      return
    }
    webPreferences.preload = GUEST_PRELOAD
    webPreferences.nodeIntegration = false
    webPreferences.nodeIntegrationInSubFrames = true
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    webPreferences.disableHtmlFullscreenWindowResize = true
    // Chrome's default autoplay rule (Electron's own default allows unmuted autoplay).
    webPreferences.autoplayPolicy = 'document-user-activation-required'
    // Popups must reach the guest's window-open handler, which keeps them in the same view.
    ;(webPreferences as Electron.WebPreferences & { disablePopups?: boolean }).disablePopups = false
  })

  win.webContents.on('did-attach-webview', (_event, contents) => {
    guest = new BrowserGuest(contents, hooks)
    contents.on('destroyed', () => {
      if (guest?.contents === contents) guest = null
    })
  })

  // Links the Tesla UI itself opens (e.g. map attribution) go to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadURL('app://ui/index.html')
  }
}

function setGear(gear: Gear): void {
  vehicle.setGear(gear)
}

vehicle.on('change', (next: VehicleState, prev: VehicleState) => {
  sendUI(IPC.vehicleChanged, next)
  if (next.gear !== prev.gear) {
    guest?.broadcastGear()
    if (next.gear !== 'P' && prev.gear === 'P') {
      guest?.setLayout('split')
      sendUI(IPC.forceCollapse)
    }
    hooks.emit({ time: Date.now(), kind: 'info', detail: `Shifted to ${next.gear}` })
  }
  if (next.location !== prev.location) void guest?.emulation.update({ location: next.location })
})

function registerIpc(): void {
  ipcMain.handle(IPC.getSnapshot, () => snapshot())
  ipcMain.handle(IPC.setGear, (_e, gear: Gear) => {
    if (['P', 'R', 'N', 'D'].includes(gear)) setGear(gear)
    return vehicle.get()
  })
  ipcMain.handle(IPC.patchVehicle, (_e, patch: Partial<VehicleState>) => {
    const { gear: _ignored, ...rest } = patch
    vehicle.patch(rest)
    return vehicle.get()
  })
  ipcMain.handle(IPC.patchSettings, (_e, patch: Partial<Settings>) => {
    const settings = store().patchSettings(patch)
    if ('profileId' in patch || 'userAgentOverride' in patch) updateSessionUserAgent()
    guest?.refreshSettings()
    sendUI(IPC.settingsChanged, settings)
    return settings
  })
  ipcMain.handle(IPC.setBrowserLayout, (_e, layout: BrowserLayout) => {
    // Expanding the browser is a Park-only feature.
    const actual: BrowserLayout = layout === 'expanded' && !vehicle.parked ? 'split' : layout
    if (actual !== layout) hooks.emit({ time: Date.now(), kind: 'fullscreen', detail: 'Expanded browser is only available in Park' })
    guest?.setLayout(actual)
    return actual
  })
  ipcMain.handle(IPC.addBookmark, (_e, url: string, title: string) => {
    const list = store().addBookmark({ url, title })
    sendUI(IPC.bookmarksChanged, list)
    return list
  })
  ipcMain.handle(IPC.removeBookmark, (_e, url: string) => {
    const list = store().removeBookmark(url)
    sendUI(IPC.bookmarksChanged, list)
    return list
  })
  ipcMain.handle(IPC.clearBrowsingData, async () => {
    const ses = session.fromPartition(GUEST_PARTITION)
    await ses.clearStorageData()
    await ses.clearCache()
    store().clearHistory()
    sendUI(IPC.historyChanged, store().history)
  })
  ipcMain.handle(IPC.openGuestDevTools, () => {
    guest?.contents.openDevTools({ mode: 'detach' })
  })
  ipcMain.handle(IPC.answerPermission, (_e, id: number, granted: boolean) => answerPermission(id, granted, hooks))

  // Guest frames
  ipcMain.on(IPC.guestInitialState, (event) => {
    const profile = PROFILES.find((p) => p.id === store().settings.profileId) ?? PROFILES[0]
    event.returnValue = { gear: vehicle.get().gear, deviceMemory: profile.deviceMemory }
  })
  ipcMain.on(IPC.guestReport, (_event, kind: GuardrailEvent['kind'], detail: string) => {
    hooks.emit({ time: Date.now(), kind, detail: String(detail).slice(0, 300) })
  })
  ipcMain.on(IPC.guestMetricsReport, (event, metrics: GuestMetrics) => {
    sendUI(IPC.guestMetrics, metrics)
    if (guest && event.sender === guest.contents) guest.emulation.verify(metrics)
  })
}

function buildMenu(): void {
  const gearItem = (gear: Gear, key: string): Electron.MenuItemConstructorOptions => ({
    label: { P: 'Park', R: 'Reverse', N: 'Neutral', D: 'Drive' }[gear],
    accelerator: `CmdOrCtrl+Shift+${key}`,
    click: () => setGear(gear)
  })
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' },
    {
      label: 'Vehicle',
      submenu: [
        gearItem('P', 'P'),
        gearItem('R', 'R'),
        gearItem('N', 'N'),
        gearItem('D', 'D'),
        { type: 'separator' },
        {
          label: 'Toggle Lock',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => vehicle.patch({ locked: !vehicle.get().locked })
        }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle Dev Drawer',
          accelerator: 'CmdOrCtrl+.',
          click: () => sendUI('menu:toggle-drawer')
        },
        {
          label: 'Open DevTools for Page',
          accelerator: 'CmdOrCtrl+Alt+J',
          click: () => guest?.contents.openDevTools({ mode: 'detach' })
        },
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => guest?.contents.reload()
        },
        { type: 'separator' },
        { label: 'Emulator UI DevTools', accelerator: 'CmdOrCtrl+Alt+I', click: () => ui()?.openDevTools({ mode: 'detach' }) },
        { label: 'Reload Emulator', accelerator: 'CmdOrCtrl+Shift+Alt+R', click: () => ui()?.reload() }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  registerAppProtocol()
  configureGuestSession(hooks)
  probeUrl = await startProbeServer()
  registerIpc()
  buildMenu()
  createWindow()
})

app.on('window-all-closed', () => app.quit())

// Test hook: lets e2e tests drive the vehicle without the UI.
;(globalThis as Record<string, unknown>).__teslaEmulator = {
  setGear,
  vehicle: () => vehicle.get(),
  guestContents: () => guest?.contents ?? null,
  probeUrl: () => probeUrl,
  events: () => recentEvents.slice(),
  layout: () => guest?.emulation.viewport ?? null
}
