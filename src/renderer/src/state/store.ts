import { create } from 'zustand'
import type {
  AppSnapshot,
  Bookmark,
  BrowserLayout,
  FirmwareProfile,
  Gear,
  GuardrailEvent,
  GuestMetrics,
  HistoryEntry,
  PermissionRequest,
  Settings,
  VehicleState
} from '@shared/types'

export type RightApp = 'map' | 'browser'

interface UIState {
  ready: boolean
  vehicle: VehicleState
  settings: Settings
  bookmarks: Bookmark[]
  history: HistoryEntry[]
  profiles: FirmwareProfile[]
  chromeVersion: string
  electronVersion: string
  guestPartition: string
  probeUrl: string

  rightApp: RightApp
  browserLayout: BrowserLayout
  launcherOpen: boolean
  drawerOpen: boolean
  stripPinned: boolean
  /** On-screen scale of the 1920x1200 stage (window px per panel px). */
  stageScale: number
  events: GuardrailEvent[]
  metrics: GuestMetrics | null
  permission: PermissionRequest | null
  /** URL the browser should navigate to next (set by popups, bookmarks, the drawer). */
  pendingNavigation: { url: string; nonce: number } | null

  hydrate: (s: AppSnapshot) => void
  setGear: (gear: Gear) => void
  patchVehicle: (patch: Partial<VehicleState>) => void
  patchSettings: (patch: Partial<Settings>) => void
  openApp: (app: RightApp) => void
  toggleApp: (app: RightApp) => void
  setBrowserLayout: (layout: BrowserLayout) => Promise<void>
  setLauncherOpen: (open: boolean) => void
  toggleDrawer: () => void
  setStripPinned: (pinned: boolean) => void
  navigate: (url: string) => void
}

const EMPTY_VEHICLE: VehicleState = {
  gear: 'P',
  locked: true,
  frunkOpen: false,
  trunkOpen: false,
  speedMph: 0,
  location: { lat: 30.2222, lng: -97.6167, accuracy: 50, heading: 0, source: 'default' }
}

const EVENT_LIMIT = 100

export const useStore = create<UIState>((set) => ({
  ready: false,
  vehicle: EMPTY_VEHICLE,
  settings: {
    profileId: '2026.26',
    userAgentOverride: '',
    theme: 'dark',
    paint: 'stealth-grey',
    trim: 'performance',
    touchInput: false,
    muted: false
  },
  bookmarks: [],
  history: [],
  profiles: [],
  chromeVersion: '',
  electronVersion: '',
  guestPartition: 'persist:tesla-browser',
  probeUrl: '',

  rightApp: 'browser',
  browserLayout: 'split',
  launcherOpen: false,
  drawerOpen: false,
  stripPinned: false,
  stageScale: 0.5,
  events: [],
  metrics: null,
  permission: null,
  pendingNavigation: null,

  hydrate: (s) =>
    set({
      ready: true,
      vehicle: s.vehicle,
      settings: s.settings,
      bookmarks: s.bookmarks,
      history: s.history,
      profiles: s.profiles,
      chromeVersion: s.chromeVersion,
      electronVersion: s.electronVersion,
      guestPartition: s.guestPartition,
      probeUrl: s.homeUrl
    }),

  setGear: (gear) => {
    set((st) => ({ vehicle: { ...st.vehicle, gear } }))
    void window.emulator.setGear(gear)
  },
  patchVehicle: (patch) => {
    set((st) => ({ vehicle: { ...st.vehicle, ...patch } }))
    void window.emulator.patchVehicle(patch)
  },
  patchSettings: (patch) => {
    set((st) => ({ settings: { ...st.settings, ...patch } }))
    void window.emulator.patchSettings(patch)
  },
  openApp: (app) => set({ rightApp: app, launcherOpen: false }),
  toggleApp: (app) => set((st) => ({ rightApp: st.rightApp === app ? 'map' : app, launcherOpen: false })),
  setBrowserLayout: async (layout) => {
    const actual = await window.emulator.setBrowserLayout(layout)
    set({ browserLayout: actual })
  },
  setLauncherOpen: (open) => set({ launcherOpen: open }),
  toggleDrawer: () => set((st) => ({ drawerOpen: !st.drawerOpen })),
  setStripPinned: (pinned) => set({ stripPinned: pinned }),
  navigate: (url) => set({ rightApp: 'browser', pendingNavigation: { url, nonce: Date.now() + Math.random() } }),
}))

/** Subscribe to main-process pushes once at startup. */
export async function connectStore(): Promise<void> {
  const api = window.emulator
  const snap = await api.getSnapshot()
  useStore.getState().hydrate(snap)
  api.onVehicle((vehicle) => useStore.setState({ vehicle }))
  api.onSettings((settings) => useStore.setState({ settings }))
  api.onBookmarks((bookmarks) => useStore.setState({ bookmarks }))
  api.onHistory((history) => useStore.setState({ history }))
  api.onGuardrail((event) =>
    useStore.setState((st) => ({ events: [event, ...st.events].slice(0, EVENT_LIMIT) }))
  )
  api.onGuestMetrics((metrics) => useStore.setState({ metrics }))
  api.onPermissionRequest((permission) => useStore.setState({ permission }))
  api.onGuestNavigate((url) => useStore.getState().navigate(url))
  api.onForceCollapse(() => {
    if (useStore.getState().browserLayout !== 'split') void useStore.getState().setBrowserLayout('split')
  })
  api.onToggleDrawer(() => useStore.getState().toggleDrawer())
}

export const isParked = (s: UIState): boolean => s.vehicle.gear === 'P'
