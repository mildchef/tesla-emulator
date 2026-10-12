export type Gear = 'P' | 'R' | 'N' | 'D'
export type Theme = 'dark' | 'light'
export type Trim = 'performance' | 'premium'
/** split: next to the car pane; expanded: over the car pane (Park only); fullscreen: HTML element fullscreen. */
export type BrowserLayout = 'split' | 'expanded' | 'fullscreen'

export interface CarLocation {
  lat: number
  lng: number
  accuracy: number
  heading: number
  source: 'gps' | 'ip' | 'manual' | 'default'
}

export interface VehicleState {
  gear: Gear
  locked: boolean
  frunkOpen: boolean
  trunkOpen: boolean
  speedMph: number
  location: CarLocation
}

export interface Settings {
  profileId: string
  /** Overrides the profile's user agent when non-empty. */
  userAgentOverride: string
  theme: Theme
  paint: string
  trim: Trim
  /** Emit touch events for mouse input (the car is a touchscreen). */
  touchInput: boolean
  muted: boolean
}

export interface Bookmark {
  url: string
  title: string
}

export interface HistoryEntry {
  url: string
  title: string
  time: number
}

export interface GuardrailEvent {
  time: number
  kind: 'video' | 'pixels' | 'fullscreen' | 'camera' | 'download' | 'popup' | 'zoom' | 'permission' | 'info'
  detail: string
}

export interface GuestMetrics {
  innerWidth: number
  innerHeight: number
  devicePixelRatio: number
  screenWidth: number
  screenHeight: number
  url: string
}

export interface PermissionRequest {
  id: number
  origin: string
  /** e.g. ['camera', 'microphone'] */
  kinds: string[]
}

export interface ViewportSize {
  width: number
  height: number
}

export interface FirmwareProfile {
  id: string
  label: string
  /** `{chrome}` is replaced with the full Chromium version actually rendering. */
  userAgent: string
  chromeMajor: number
  devicePixelRatio: number
  screen: ViewportSize
  /** CSS-pixel inner window size reported by the car browser. Fullscreen uses `screen`. */
  viewport: Record<'split' | 'expanded', ViewportSize>
  pointer: 'fine' | 'coarse'
  hover: 'hover' | 'none'
  colorScheme: 'light' | 'dark'
  deviceMemory: number
  notes: string
}

export interface AppSnapshot {
  vehicle: VehicleState
  settings: Settings
  bookmarks: Bookmark[]
  history: HistoryEntry[]
  profiles: FirmwareProfile[]
  chromeVersion: string
  electronVersion: string
  guestPreloadUrl: string
  guestPartition: string
  homeUrl: string
}
