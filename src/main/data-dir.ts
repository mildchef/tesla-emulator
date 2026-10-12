import { app } from 'electron'
import { cpSync, existsSync, renameSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

/** Caches, crash dumps and lock files are not worth carrying over. */
const SKIP = /^(Cache|Code Cache|GPUCache|DawnGraphiteCache|DawnWebGPUCache|GrShaderCache|ShaderCache|Crashpad|Singleton\w*|DevToolsActivePort)$/

/**
 * Keeps the emulator's data (settings, bookmarks, history, and the test
 * browser's cookies and storage) in `.emulator-data/` inside the project
 * instead of ~/Library/Application Support. Data saved there before the move
 * is copied over once. Tests pass their own folder in TESLA_EMU_USER_DATA.
 */
export function useProjectDataDir(): void {
  if (process.env.TESLA_EMU_USER_DATA) {
    app.setPath('userData', process.env.TESLA_EMU_USER_DATA)
    return
  }
  if (app.isPackaged) return
  const dir = join(app.getAppPath(), '.emulator-data')
  const legacy = app.getPath('userData')
  if (!existsSync(dir) && existsSync(legacy)) {
    // Copy to a temporary name first so a second instance starting at the same time never sees half a copy.
    const partial = `${dir}.partial-${process.pid}`
    try {
      cpSync(legacy, partial, { recursive: true, filter: (src) => !SKIP.test(basename(src)) })
      renameSync(partial, dir)
    } catch (err) {
      rmSync(partial, { recursive: true, force: true })
      if (!existsSync(dir)) console.warn('[data] could not copy the old data folder:', err)
    }
  }
  app.setPath('userData', dir)
}
