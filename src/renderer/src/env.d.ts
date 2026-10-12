/// <reference types="vite/client" />
import type { EmulatorApi } from '../../preload/ui'

declare global {
  interface Window {
    emulator: EmulatorApi
  }
}

export {}
