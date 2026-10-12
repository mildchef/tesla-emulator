import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Bookmark, HistoryEntry, Settings } from '../shared/types'
import { DEFAULT_PROFILE_ID } from '../shared/profiles'

interface Persisted {
  settings: Settings
  bookmarks: Bookmark[]
  history: HistoryEntry[]
}

const DEFAULTS: Persisted = {
  settings: {
    profileId: DEFAULT_PROFILE_ID,
    userAgentOverride: '',
    theme: 'dark',
    paint: 'stealth-grey',
    trim: 'performance',
    touchInput: false,
    muted: false
  },
  bookmarks: [
    { url: 'https://www.youtube.com/', title: 'YouTube' },
    { url: 'https://www.tesla.com/', title: 'Tesla' },
    { url: 'https://www.google.com/', title: 'Google' }
  ],
  history: []
}

const HISTORY_LIMIT = 200

class Store {
  private data: Persisted
  private readonly file: string
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    this.file = join(app.getPath('userData'), 'tesla-emulator.json')
    this.data = structuredClone(DEFAULTS)
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Persisted>
        this.data = {
          settings: { ...DEFAULTS.settings, ...raw.settings },
          bookmarks: raw.bookmarks ?? DEFAULTS.bookmarks,
          history: raw.history ?? []
        }
      }
    } catch (err) {
      console.warn('[store] could not read settings, using defaults', err)
    }
  }

  get settings(): Settings {
    return this.data.settings
  }
  get bookmarks(): Bookmark[] {
    return this.data.bookmarks
  }
  get history(): HistoryEntry[] {
    return this.data.history
  }

  patchSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.save()
    return this.data.settings
  }

  addBookmark(b: Bookmark): Bookmark[] {
    if (!this.data.bookmarks.some((x) => x.url === b.url)) this.data.bookmarks = [...this.data.bookmarks, b]
    this.save()
    return this.data.bookmarks
  }

  removeBookmark(url: string): Bookmark[] {
    this.data.bookmarks = this.data.bookmarks.filter((x) => x.url !== url)
    this.save()
    return this.data.bookmarks
  }

  addHistory(entry: HistoryEntry): HistoryEntry[] {
    const rest = this.data.history.filter((h) => h.url !== entry.url)
    this.data.history = [entry, ...rest].slice(0, HISTORY_LIMIT)
    this.save()
    return this.data.history
  }

  updateHistoryTitle(url: string, title: string): HistoryEntry[] {
    const hit = this.data.history.find((h) => h.url === url)
    if (hit && title) {
      hit.title = title
      this.save()
    }
    return this.data.history
  }

  clearHistory(): void {
    this.data.history = []
    this.save()
  }

  private save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try {
        mkdirSync(dirname(this.file), { recursive: true })
        writeFileSync(this.file, JSON.stringify(this.data, null, 2))
      } catch (err) {
        console.warn('[store] could not save settings', err)
      }
    }, 150)
  }
}

let instance: Store | null = null
export function store(): Store {
  instance ??= new Store()
  return instance
}
