import { expect, test, type ElectronApplication } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { launch, ROOT, serveFixtures } from './harness'

const run = promisify(execFile)
const EMU = join(ROOT, 'packages', 'tesla-web-dev', 'plugins', 'tesla-web-dev', 'skills', 'tesla-web-dev', 'scripts', 'emu.mjs')

let app: ElectronApplication
let controlFile: string
let site: { url: string; close: () => void }

test.beforeAll(async () => {
  site = await serveFixtures()
  const launched = await launch()
  app = launched.app
  controlFile = join(launched.userData, 'control.json')
  await expect.poll(() => existsSync(controlFile), { timeout: 30_000 }).toBe(true)
})

test.afterAll(async () => {
  await app?.close()
  site?.close()
})

/** Runs the skill's `emu` CLI against this test instance. */
async function emu(...args: string[]): Promise<string> {
  const { stdout } = await run(process.execPath, [EMU, ...args], {
    env: { ...process.env, TESLA_EMU_CONTROL: controlFile },
    timeout: 60_000
  })
  return stdout.trim()
}

test('the control server only answers local callers with the token', async () => {
  const { port, token } = JSON.parse(readFileSync(controlFile, 'utf8')) as { port: number; token: string }
  const base = `http://127.0.0.1:${port}/status`
  expect((await fetch(base)).status).toBe(401)
  expect((await fetch(base, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401)
  // A web page (e.g. the one under test) always sends an Origin header.
  expect((await fetch(base, { headers: { Authorization: `Bearer ${token}`, Origin: 'http://evil.example' } })).status).toBe(403)
  expect((await fetch(base, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200)
})

test('emu drives the car browser: open, eval, gear, layout, screenshot, console, events', async () => {
  expect(await emu('status')).toContain('gear P (parked)')

  const port = new URL(site.url).port
  expect(await emu('open', `localhost:${port}/target.html`)).toContain(`Loaded http://localhost:${port}/target.html  "Target"`)
  const [w, h, dpr] = JSON.parse(await emu('eval', '[innerWidth, innerHeight, devicePixelRatio]')) as number[]
  expect([w, h]).toEqual([773, 601])
  expect(dpr).toBeCloseTo(1.53, 2)

  await emu('console', '--clear')
  await emu('eval', 'console.error("boom from the page")')
  await expect.poll(() => emu('console', '--errors')).toContain('[error] boom from the page')

  const status = JSON.parse(await emu('gear', 'D', '--json')) as { gear: string; parked: boolean }
  expect(status).toMatchObject({ gear: 'D', parked: false })
  expect(await emu('layout', 'expanded')).toContain('only available in Park')
  expect(await emu('events')).toContain('Shifted to D')

  await emu('gear', 'P')
  expect(await emu('layout', 'expanded')).toContain('viewport 1254x601')
  expect(await emu('eval', 'innerWidth')).toBe('1254')
  await emu('layout', 'split')

  for (const target of ['page', 'screen']) {
    const shot = JSON.parse(await emu('shot', target, '--json')) as { file: string; size: string }
    expect(statSync(shot.file).size).toBeGreaterThan(1000)
    expect(readFileSync(shot.file).subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(shot.size).toMatch(/^\d+x\d+$/)
  }

  const probe = JSON.parse(await emu('probe')) as Record<string, unknown>
  expect(probe).toMatchObject({ innerWidth: 773, innerHeight: 601 })
})
