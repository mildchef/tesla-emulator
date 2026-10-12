import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite's isolatedEntries progress reporter calls TTY-only methods; give
// non-TTY stdout (CI, piped output) no-op versions so the build doesn't crash.
const out = process.stdout as NodeJS.WriteStream
out.clearLine ??= () => true
out.cursorTo ??= () => true
out.moveCursor ??= () => true

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } }
    }
  },
  preload: {
    build: {
      // Sandboxed preloads can't require() sibling chunks: bundle each entry on its own.
      isolatedEntries: true,
      rollupOptions: {
        input: {
          ui: resolve(__dirname, 'src/preload/ui.ts'),
          guest: resolve(__dirname, 'src/preload/guest.ts')
        },
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } }
    },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    // Off the usual dev ports (Vite's 5173, 3000, 8080…), so the web app under test can keep them.
    server: { port: 47173 },
    plugins: [react()]
  }
})
