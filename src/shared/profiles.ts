import type { FirmwareProfile } from './types'

/**
 * What the car's browser reports to web pages, by firmware generation.
 *
 * Sources: owner measurements after the 2026.26 summer update (DPR 1.0 -> 1.53,
 * screen 1920x1200 -> 1254x784, a 773x601 inner window in split view, Chrome
 * 140 -> 148, pointer/hover and prefers-color-scheme flipping). Values marked
 * "derived" are computed from the 1920x1200 panel and the UI layout, not measured.
 * Calibrate by opening test/fixtures/probe.html in the car.
 */
export const PROFILES: FirmwareProfile[] = [
  {
    id: '2026.26',
    label: '2026.26+ · Chromium 148 · DPR 1.53',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 TeslaBrowser/{chrome}',
    chromeMajor: 148,
    devicePixelRatio: 1.53,
    screen: { width: 1254, height: 784 },
    viewport: {
      split: { width: 773, height: 601 },
      // derived: full panel width / 1.53, same height as split view
      expanded: { width: 1254, height: 601 }
    },
    pointer: 'fine',
    hover: 'hover',
    colorScheme: 'light',
    deviceMemory: 2,
    notes: 'Current firmware (summer 2026 update and later, incl. 2026.32).'
  },
  {
    id: 'legacy',
    label: 'Pre-2026.26 · Chromium 140 · DPR 1.0',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 TeslaBrowser/140.0.7339.207',
    chromeMajor: 140,
    devicePixelRatio: 1,
    screen: { width: 1920, height: 1200 },
    viewport: {
      // derived from the browser content box in panel pixels
      split: { width: 1183, height: 920 },
      expanded: { width: 1920, height: 920 }
    },
    pointer: 'coarse',
    hover: 'none',
    colorScheme: 'dark',
    deviceMemory: 1,
    notes: 'Cars that have not taken the summer 2026 update. The rendering engine is still Chromium 148.'
  }
]

export const DEFAULT_PROFILE_ID = PROFILES[0].id

export function getProfile(id: string): FirmwareProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0]
}

export function resolveUserAgent(profile: FirmwareProfile, chromeVersion: string, override: string): string {
  if (override.trim()) return override.trim()
  return profile.userAgent.replace('{chrome}', chromeVersion)
}
