import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AppSnapshot,
  Bookmark,
  BrowserLayout,
  Gear,
  GuardrailEvent,
  GuestMetrics,
  HistoryEntry,
  PermissionRequest,
  Settings,
  VehicleState
} from '../shared/types'

function on<T extends unknown[]>(channel: string, fn: (...args: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void => fn(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  getSnapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke(IPC.getSnapshot),
  setGear: (gear: Gear): Promise<VehicleState> => ipcRenderer.invoke(IPC.setGear, gear),
  patchVehicle: (patch: Partial<VehicleState>): Promise<VehicleState> => ipcRenderer.invoke(IPC.patchVehicle, patch),
  patchSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke(IPC.patchSettings, patch),
  setBrowserLayout: (layout: BrowserLayout): Promise<BrowserLayout> => ipcRenderer.invoke(IPC.setBrowserLayout, layout),
  addBookmark: (url: string, title: string): Promise<Bookmark[]> => ipcRenderer.invoke(IPC.addBookmark, url, title),
  removeBookmark: (url: string): Promise<Bookmark[]> => ipcRenderer.invoke(IPC.removeBookmark, url),
  clearBrowsingData: (): Promise<void> => ipcRenderer.invoke(IPC.clearBrowsingData),
  openGuestDevTools: (): Promise<void> => ipcRenderer.invoke(IPC.openGuestDevTools),
  answerPermission: (id: number, granted: boolean): Promise<void> => ipcRenderer.invoke(IPC.answerPermission, id, granted),

  onVehicle: (fn: (v: VehicleState) => void) => on(IPC.vehicleChanged, fn),
  onSettings: (fn: (s: Settings) => void) => on(IPC.settingsChanged, fn),
  onBookmarks: (fn: (b: Bookmark[]) => void) => on(IPC.bookmarksChanged, fn),
  onHistory: (fn: (h: HistoryEntry[]) => void) => on(IPC.historyChanged, fn),
  onGuardrail: (fn: (e: GuardrailEvent) => void) => on(IPC.guardrailEvent, fn),
  onGuestMetrics: (fn: (m: GuestMetrics) => void) => on(IPC.guestMetrics, fn),
  onPermissionRequest: (fn: (r: PermissionRequest) => void) => on(IPC.permissionRequest, fn),
  onGuestNavigate: (fn: (url: string) => void) => on(IPC.guestNavigate, fn),
  onForceCollapse: (fn: () => void) => on(IPC.forceCollapse, fn),
  onSetLayout: (fn: (layout: BrowserLayout) => void) => on(IPC.setLayout, fn),
  onToggleDrawer: (fn: () => void) => on('menu:toggle-drawer', fn)
}

export type EmulatorApi = typeof api

contextBridge.exposeInMainWorld('emulator', api)
