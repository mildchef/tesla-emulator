#!/usr/bin/env node
/**
 * emu: drives the Tesla Emulator (github.com/mildchef/tesla-emulator) from the
 * command line, for testing web apps in its car browser. Talks to the
 * emulator's local control server; the port and token come from
 * .emulator-data/control.json in the emulator folder.
 *
 * Finds the emulator folder from, in order: $TESLA_EMULATOR_DIR, a folder
 * this script sits inside (when the skill is used from an emulator checkout),
 * or the folder saved with `emu setup <dir>`.
 *
 * Run `node emu.mjs help` for the commands.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(realpathSync(fileURLToPath(import.meta.url)))
const CONFIG = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'tesla-web-dev', 'config.json')
const REPO = 'https://github.com/mildchef/tesla-emulator'

function isEmulator(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name === 'tesla-emulator'
  } catch {
    return false
  }
}

function savedDir() {
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8')).emulatorDir
  } catch {
    return undefined
  }
}

function findEmulator() {
  if (process.env.TESLA_EMULATOR_DIR) return resolve(process.env.TESLA_EMULATOR_DIR)
  for (let dir = HERE; dirname(dir) !== dir; dir = dirname(dir)) if (isEmulator(dir)) return dir
  const saved = savedDir()
  if (saved && isEmulator(saved)) return saved
  return null
}

function emulatorDir() {
  const dir = findEmulator()
  if (dir) return dir
  throw new EmuError(
    `Can't find the Tesla Emulator. If you have it, run: emu setup /path/to/tesla-emulator\n` +
      `To get it: git clone ${REPO} && emu setup tesla-emulator`
  )
}

function controlFile() {
  return process.env.TESLA_EMU_CONTROL ?? join(emulatorDir(), '.emulator-data', 'control.json')
}

const HELP = `emu: drive the Tesla Emulator's car browser

  emu setup <dir>                 remember where the emulator is (once, if emu can't find it)
  emu start                       start the emulator if needed and wait until it is ready
  emu stop                        quit the emulator
  emu status                      gear, layout, viewport and the open page
  emu open <address>              load an address, as if typed in the address bar
  emu reload | back | forward
  emu gear <P|R|N|D>              shift; R, N and D apply the driving guardrails
  emu layout <split|expanded>     browser size (expanded is Park-only)
  emu shot [page|screen] [--out <file.png>]
                                  screenshot of the web page or the whole car screen;
                                  prints the PNG's path
  emu eval <javascript>           run code in the page and print the result as JSON
  emu console [--errors] [--since <n>] [--clear]
                                  the page's console output, load failures and crashes
  emu events [--since <ms>]       the guardrail log (blocked video, fullscreen, camera, popups, downloads)
  emu set key=value ...           theme=dark|light  profile=2026.26|legacy  touch=on|off
                                  muted=on|off  ua=<user agent, empty to reset>
  emu probe                       open the probe page and print what the browser reports
  emu devtools                    open Chrome DevTools for the page

  Add --json to any command for the raw response.`

class EmuError extends Error {}

function control() {
  const file = controlFile()
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new EmuError(`The emulator isn't running (no ${file}). Start it with: emu start`)
  }
}

async function call(method, path, body) {
  const { port, token } = control()
  let res
  try {
    res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new EmuError("The emulator isn't running (its control server didn't answer). Start it with: emu start")
  }
  if ((res.headers.get('content-type') ?? '').startsWith('image/')) return Buffer.from(await res.arrayBuffer())
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new EmuError(json.error ?? `HTTP ${res.status}`)
  return json
}

const get = (path) => call('GET', path)
const post = (path, body = {}) => call('POST', path, body)

function flags(args) {
  const out = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--') && ['out', 'since'].includes(key)) {
        out[key] = next
        i++
      } else out[key] = true
    } else out._.push(a)
  }
  return out
}

function describe(s) {
  const page = s.page ? `${s.page.title ? `"${s.page.title}" ` : ''}${s.page.url || '(blank)'}${s.page.loading ? ' (loading)' : ''}` : '(browser not ready)'
  const vp = s.viewport ? `${s.viewport.width}x${s.viewport.height}` : '?'
  return [
    `gear ${s.gear}${s.parked ? ' (parked)' : ' (driving guardrails on)'}  layout ${s.layout ?? '?'}  viewport ${vp} @ DPR ${s.devicePixelRatio}  screen ${s.screen.width}x${s.screen.height}`,
    `profile ${s.profile}  theme ${s.theme}  touch ${s.touchInput ? 'on' : 'off'}${s.muted ? '  muted' : ''}`,
    `page ${page}`
  ].join('\n')
}

function pngSize(buf) {
  return buf.length > 24 && buf.toString('ascii', 12, 16) === 'IHDR' ? `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` : '?'
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
}

async function running() {
  try {
    const s = await get('/status')
    return s.page ? s : null
  } catch {
    return null
  }
}

async function start(opts) {
  const already = await running()
  if (already) return already
  const ROOT = emulatorDir()
  if (!existsSync(join(ROOT, 'node_modules'))) {
    if (!opts.json) process.stderr.write('Installing the emulator\'s dependencies (first run)…\n')
    await new Promise((res, rej) =>
      spawn('npm', ['install'], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' }).on('exit', (code) =>
        code === 0 ? res() : rej(new EmuError('npm install failed in ' + ROOT))
      )
    )
  }
  const logDir = join(ROOT, '.emulator-data')
  mkdirSync(logDir, { recursive: true })
  const log = openSync(join(logDir, 'emulator.log'), 'a')
  const script = join(ROOT, 'Run Tesla Emulator.command')
  // The macOS launcher installs dependencies and builds the 3D car when needed.
  const [cmd, args] =
    process.platform === 'darwin' && existsSync(script) ? ['/bin/zsh', ['-l', script]] : ['npm', ['run', 'dev']]
  const child = spawn(cmd, args, { cwd: ROOT, detached: true, stdio: ['ignore', log, log], shell: process.platform === 'win32' })
  child.unref()
  if (!opts.json) process.stderr.write(`Starting the emulator (log: ${join(logDir, 'emulator.log')})`)
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000))
    const s = await running()
    if (s) {
      if (!opts.json) process.stderr.write(' ready\n')
      return s
    }
    if (!opts.json) process.stderr.write('.')
  }
  throw new EmuError(`The emulator didn't come up within 4 minutes; see ${join(logDir, 'emulator.log')}`)
}

function print(opts, json, text) {
  console.log(opts.json ? JSON.stringify(json, null, 2) : text)
}

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2)
  const opts = flags(rest)
  const arg = opts._.join(' ')

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return
    case 'setup': {
      const dir = resolve(arg || '.')
      if (!isEmulator(dir)) throw new EmuError(`${dir} isn't a Tesla Emulator checkout (no package.json named tesla-emulator)`)
      mkdirSync(dirname(CONFIG), { recursive: true })
      writeFileSync(CONFIG, JSON.stringify({ emulatorDir: dir }, null, 2) + '\n')
      return print(opts, { emulatorDir: dir }, `Saved: the emulator is at ${dir}`)
    }
    case 'start': {
      const s = await start(opts)
      return print(opts, s, describe(s))
    }
    case 'stop':
      await post('/quit')
      return print(opts, { ok: true }, 'Emulator quit.')
    case 'status': {
      const s = await get('/status')
      return print(opts, s, describe(s))
    }
    case 'open': {
      if (!arg) throw new EmuError('Usage: emu open <address>')
      const r = await post('/navigate', { url: arg })
      return print(opts, r, r.ok ? `Loaded ${r.page.url}${r.page.title ? `  "${r.page.title}"` : ''}` : `Load failed: ${r.error}`)
    }
    case 'reload':
    case 'back':
    case 'forward': {
      const r = await post(`/${command}`)
      return print(opts, r, r.ok ? `Loaded ${r.page.url}` : `Load failed: ${r.error}`)
    }
    case 'gear': {
      if (!arg) throw new EmuError('Usage: emu gear <P|R|N|D>')
      const s = await post('/gear', { gear: arg })
      return print(opts, s, describe(s))
    }
    case 'layout': {
      const s = await post('/layout', { layout: arg })
      return print(opts, s, describe(s) + (s.note ? `\nnote: ${s.note}` : ''))
    }
    case 'shot': {
      const target = opts._[0] ?? 'page'
      const png = await get(`/screenshot?target=${encodeURIComponent(target)}`)
      const out = resolve(opts.out ?? join(tmpdir(), 'tesla-emu', `${target}-${stamp()}.png`))
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, png)
      return print(opts, { file: out, size: pngSize(png) }, `${out}  (${pngSize(png)})`)
    }
    case 'eval': {
      if (!arg) throw new EmuError('Usage: emu eval <javascript>')
      const r = await post('/eval', { code: arg })
      if (!r.ok) throw new EmuError(`Script error: ${r.error}`)
      return print(opts, r, JSON.stringify(r.result, null, 2))
    }
    case 'console': {
      if (opts.clear) {
        await post('/console/clear')
        return print(opts, { ok: true }, 'Console log cleared.')
      }
      const q = new URLSearchParams()
      if (opts.since) q.set('since', opts.since)
      if (opts.errors) q.set('level', 'error')
      const r = await get(`/console?${q}`)
      const lines = r.entries.map((e) => `[${e.level}] ${e.message}${e.source ? `  (${e.source}${e.line ? `:${e.line}` : ''})` : ''}`)
      return print(opts, r, lines.length ? lines.join('\n') : '(nothing logged)')
    }
    case 'events': {
      const r = await get(`/events${opts.since ? `?since=${opts.since}` : ''}`)
      const lines = r.events.map((e) => `${new Date(e.time).toLocaleTimeString()}  ${e.kind.padEnd(10)} ${e.detail}`)
      return print(opts, r, lines.length ? lines.join('\n') : '(no guardrail events)')
    }
    case 'set': {
      const patch = {}
      for (const pair of opts._) {
        const i = pair.indexOf('=')
        if (i < 0) throw new EmuError(`Expected key=value, got "${pair}"`)
        const key = pair.slice(0, i)
        const value = pair.slice(i + 1)
        const on = ['on', 'true', '1', 'yes'].includes(value.toLowerCase())
        if (key === 'theme') patch.theme = value
        else if (key === 'profile') patch.profileId = value
        else if (key === 'ua') patch.userAgentOverride = value
        else if (key === 'touch') patch.touchInput = on
        else if (key === 'muted') patch.muted = on
        else throw new EmuError(`Unknown setting "${key}" (theme, profile, ua, touch, muted)`)
      }
      const s = await post('/settings', patch)
      return print(opts, s, describe(s))
    }
    case 'probe': {
      const s = await get('/status')
      await post('/navigate', { url: s.probeUrl })
      const r = await post('/eval', { code: 'window.__probe' })
      if (!r.ok) throw new EmuError(`Probe failed: ${r.error}`)
      return print(opts, r.result, JSON.stringify(r.result, null, 2))
    }
    case 'devtools':
      await post('/devtools')
      return print(opts, { ok: true }, 'DevTools opened.')
    default:
      throw new EmuError(`Unknown command "${command}". Run: emu help`)
  }
}

main().catch((err) => {
  console.error(err instanceof EmuError ? err.message : err)
  process.exit(1)
})
