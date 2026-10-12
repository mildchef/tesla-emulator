/**
 * Preload for the car browser guest. Runs in every frame (nodeIntegrationInSubFrames),
 * including cross-site iframes, before any page script.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { installGuardrails, type GuardrailsApi } from '../guest/guardrails'
import { IPC } from '../shared/ipc'

const initial = ipcRenderer.sendSync(IPC.guestInitialState) as { gear: string; deviceMemory: number }

const report = (kind: string, detail: string): void => {
  const where = location.href.startsWith('http') ? ` — ${location.host}` : ''
  ipcRenderer.send(IPC.guestReport, kind, `${detail}${where}`)
}

let api: GuardrailsApi | null = null
try {
  api = contextBridge.executeInMainWorld({
    func: installGuardrails,
    args: [initial.gear, initial.deviceMemory, report]
  }) as GuardrailsApi
} catch (err) {
  console.error('[tesla-emulator] failed to install guardrails', err)
}

ipcRenderer.on(IPC.guestGear, (_event, gear: string) => api?.setGear(gear))

// The top frame reports what the page sees so the dev drawer can show it.
if (window === window.top) {
  const send = (): void => {
    ipcRenderer.send(IPC.guestMetricsReport, {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      screenWidth: screen.width,
      screenHeight: screen.height,
      url: location.href
    })
  }
  window.addEventListener('resize', send)
  window.addEventListener('DOMContentLoaded', send)
  window.addEventListener('load', send)
}
