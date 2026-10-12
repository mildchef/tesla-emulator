import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { captureSize, frameEval, guestEval, launch, navigate, regionHash, serveFixtures, setGear, sleep } from './harness'

let app: ElectronApplication
let win: Page
let siteA: { url: string; close: () => void }
let siteB: { url: string; close: () => void }

test.beforeAll(async () => {
  siteA = await serveFixtures()
  siteB = await serveFixtures()
  ;({ app, win } = await launch())
})

test.afterAll(async () => {
  await app?.close()
  siteA?.close()
  siteB?.close()
})

test.afterEach(async () => {
  await setGear(app, 'P')
})

type VideoState = { paused: boolean; muted: boolean; time: number; rect: { x: number; y: number; width: number; height: number } }

test('reports the car viewport, DPR, screen, UA and media features', async () => {
  const probeUrl = await app.evaluate(() => globalThis.__teslaEmulator.probeUrl())
  await navigate(app, win, probeUrl)
  const probe = await guestEval<Record<string, unknown>>(app, 'window.__probe')
  expect(probe.innerWidth).toBe(773)
  expect(probe.innerHeight).toBe(601)
  expect(probe.devicePixelRatio as number).toBeCloseTo(1.53, 2)
  expect(probe.screen).toBe('1254×784')
  expect(probe.userAgent).toMatch(/^Mozilla\/5\.0 \(X11; Linux x86_64\).*Chrome\/148\.0\.0\.0 Safari\/537\.36 TeslaBrowser\/148\./)
  expect(probe.uaPlatform).toBe('Linux')
  expect(probe.pointer).toBe('fine')
  expect(probe.hover).toBe('hover')
  expect(probe.prefersColorScheme).toBe('light')
  expect(probe.deviceMemory).toBe(2)
  expect(probe.outerWidth).toBe(773)

  // The page is laid out at 773 CSS px and drawn 1.53x to fill the content box.
  const size = await captureSize(app)
  expect(size.width / size.height).toBeCloseTo(1183 / 920, 2)
})

test('expanding the browser is Park-only and reports the wider viewport', async () => {
  await navigate(app, win, `${siteA.url}/target.html`)
  const expand = win.getByTestId('browser-expand')
  await expand.click()
  await expect.poll(() => guestEval(app, 'innerWidth')).toBe(1254)
  expect(await guestEval(app, 'innerHeight')).toBe(601)

  await setGear(app, 'D')
  await expect.poll(() => guestEval(app, 'innerWidth')).toBe(773)
  await expect(expand).toBeDisabled()
})

test('in Drive a playing video freezes but keeps playing (audio continues)', async () => {
  await navigate(app, win, `${siteA.url}/video.html`)
  const started = await guestEval<{ paused: boolean; muted: boolean; hasAudio: boolean }>(app, 'startVideo()', true)
  expect(started).toEqual({ paused: false, muted: false, hasAudio: true })
  await sleep(600)

  const s0 = await guestEval<VideoState>(app, 'videoState()')
  // Parked: the picture is live.
  const p1 = await regionHash(app, s0.rect)
  await sleep(400)
  const p2 = await regionHash(app, s0.rect)
  expect(p1).not.toBe(p2)

  await setGear(app, 'D')
  await expect.poll(() => guestEval(app, 'isFrozen()')).toBe(true)
  await sleep(300)
  const d1 = await regionHash(app, s0.rect)
  const t1 = (await guestEval<VideoState>(app, 'videoState()')).time
  await sleep(700)
  const d2 = await regionHash(app, s0.rect)
  const s2 = await guestEval<VideoState>(app, 'videoState()')
  expect(d1).toBe(d2) // picture frozen
  expect(s2.paused).toBe(false) // element still playing → audio continues
  expect(s2.muted).toBe(false)
  expect(s2.time).toBeGreaterThan(t1)

  const events = await app.evaluate(() => globalThis.__teslaEmulator.events())
  expect(events.some((e) => e.kind === 'video')).toBe(true)

  // Back in Park the picture is live again.
  await setGear(app, 'P')
  await expect.poll(() => guestEval(app, 'isFrozen()')).toBe(false)
  await sleep(300)
  const r1 = await regionHash(app, s0.rect)
  await sleep(400)
  const r2 = await regionHash(app, s0.rect)
  expect(r1).not.toBe(r2)
})

test('video pixel reads come back black while driving', async () => {
  await navigate(app, win, `${siteA.url}/video.html`)
  await guestEval(app, 'startVideo()', true)
  await sleep(500)
  const parked = await guestEval<number[]>(app, 'readCenterPixel("2d")')
  expect(parked[0] + parked[1] + parked[2]).toBeGreaterThan(60)

  await setGear(app, 'D')
  await sleep(200)
  expect(await guestEval<number[]>(app, 'readCenterPixel("2d")')).toEqual([0, 0, 0, 255])
  expect(await guestEval<number[]>(app, 'readCenterPixel("bitmap")')).toEqual([0, 0, 0, 255])
})

test('guardrails also apply inside cross-origin iframes', async () => {
  await navigate(app, win, `${siteA.url}/iframe.html?other=${encodeURIComponent(siteB.url)}`)
  await expect.poll(() => frameEval(app, siteB.url, 'typeof startVideo')).toBe('function')
  await frameEval(app, siteB.url, 'startVideo()', true)
  await sleep(600)
  // The video sits at the iframe's top-left, and the iframe at the page's top-left.
  const rect = { x: 0, y: 0, width: 320, height: 180 }

  await setGear(app, 'D')
  await expect.poll(() => frameEval(app, siteB.url, 'isFrozen()')).toBe(true)
  await sleep(300)
  const d1 = await regionHash(app, rect)
  await sleep(700)
  const d2 = await regionHash(app, rect)
  expect(d1).toBe(d2)
  const state = await frameEval<VideoState>(app, siteB.url, 'videoState()')
  expect(state.paused).toBe(false)
  expect(await frameEval<number[]>(app, siteB.url, 'readCenterPixel("2d")')).toEqual([0, 0, 0, 255])
  expect(await frameEval<string>(app, siteB.url, 'tryFullscreen()', true)).toBe('NotAllowedError')
})

test('fullscreen works in Park, is exited and refused when shifting out of Park', async () => {
  await navigate(app, win, `${siteA.url}/video.html`)
  await guestEval(app, 'startVideo()', true)
  expect(await guestEval(app, 'tryFullscreen()', true)).toBe('ok')
  await expect.poll(() => guestEval(app, '[innerWidth, innerHeight].join("x")')).toBe('1254x784')

  await setGear(app, 'D')
  await expect.poll(() => guestEval(app, '!!document.fullscreenElement')).toBe(false)
  await expect.poll(() => guestEval(app, 'innerWidth')).toBe(773)
  expect(await guestEval(app, 'tryFullscreen()', true)).toBe('NotAllowedError')
})

test('the camera is refused while driving', async () => {
  await navigate(app, win, `${siteA.url}/video.html`)
  await setGear(app, 'R')
  const result = await guestEval<string>(app, 'tryCamera()', true)
  expect(result).toMatch(/^NotAllowedError: The camera is only available while parked/)
})

test('swiping the drive mode strip up selects Drive, tapping P parks', async () => {
  const strip = win.getByTestId('drive-strip')
  const track = win.getByTestId('strip-track')
  await strip.hover({ position: { x: 20, y: 300 } })
  const box = (await track.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.mouse.move(x, y - box.height * 0.3, { steps: 8 })
  await win.mouse.up()
  await expect(strip).toHaveAttribute('data-gear', 'D')
  expect(await app.evaluate(() => globalThis.__teslaEmulator.vehicle().gear)).toBe('D')
  await expect(win.getByTestId('car-pane')).toHaveAttribute('data-mode', 'drive')

  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.mouse.move(x, y + box.height * 0.3, { steps: 8 })
  await win.mouse.up()
  await expect(strip).toHaveAttribute('data-gear', 'R')

  await win.getByTestId('strip-park').click()
  await expect(strip).toHaveAttribute('data-gear', 'P')
})

async function knobY(): Promise<number> {
  const b = (await win.getByTestId('strip-knob').boundingBox())!
  return b.y + b.height / 2
}

test('the strip knob follows the pointer and a release anywhere shifts', async () => {
  await setGear(app, 'R')
  const strip = win.getByTestId('drive-strip')
  await expect(strip).toHaveAttribute('data-gear', 'R')
  const knob = win.getByTestId('strip-knob')
  await sleep(400) // let the knob settle at the R position
  const kb = (await knob.boundingBox())!
  const x = kb.x + kb.width / 2
  const y = kb.y + kb.height / 2
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.mouse.move(x, y - 60, { steps: 6 })
  expect(Math.abs((await knobY()) - (y - 60))).toBeLessThan(3)
  await win.mouse.move(x, y - 150, { steps: 6 })
  await expect(knob).toHaveAttribute('data-pending', 'D')
  // Wander off the strip over the car pane and let go there.
  await win.mouse.move(x + 120, y - 150, { steps: 6 })
  await win.mouse.up()
  await expect(strip).toHaveAttribute('data-gear', 'D')
  await sleep(400)
  const settled = await knobY()
  // Hovering the strip afterwards must not drag the knob along.
  await win.mouse.move(x, y, { steps: 6 })
  await win.mouse.move(x, y - 100, { steps: 6 })
  expect(Math.abs((await knobY()) - settled)).toBeLessThan(1)
})

test('a swipe still ends when its release never reaches the strip', async () => {
  await setGear(app, 'D')
  const strip = win.getByTestId('drive-strip')
  await expect(strip).toHaveAttribute('data-gear', 'D')
  await sleep(400)
  await win.evaluate(() => window.addEventListener('pointerdown', (e) => ((window as unknown as { __pid: number }).__pid = e.pointerId), { once: true, capture: true }))
  const kb = (await win.getByTestId('strip-knob').boundingBox())!
  const x = kb.x + kb.width / 2
  const y = kb.y + kb.height / 2
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.mouse.move(x, y + 150, { steps: 6 })
  // A move with no buttons held means the button came up somewhere we never heard about.
  await win.evaluate(
    ([cx, cy]) =>
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: (window as unknown as { __pid: number }).__pid, buttons: 0, clientX: cx, clientY: cy, bubbles: true })
      ),
    [x, y + 150]
  )
  await expect(strip).toHaveAttribute('data-gear', 'R')
  await win.mouse.up()
})

test('popups open in the same view and downloads are blocked', async () => {
  await navigate(app, win, `${siteA.url}/popup.html`)
  await guestEval(app, 'openPopup()', true)
  await expect
    .poll(() => app.evaluate(() => globalThis.__teslaEmulator.guestContents()!.getURL()))
    .toContain('/target.html?via=window.open')

  await navigate(app, win, `${siteA.url}/popup.html`)
  await guestEval(app, 'document.getElementById("dl").click()', true)
  await expect
    .poll(async () => (await app.evaluate(() => globalThis.__teslaEmulator.events())).some((e) => e.kind === 'download'))
    .toBe(true)
})

test('the car pane shows the 3D car (or its stand-in) and switches to the drive view', async () => {
  const pane = win.getByTestId('car-pane')
  await expect(pane.locator('[data-testid=car-3d], [data-testid=car-placeholder]').first()).toBeVisible()
  await expect(pane).toHaveAttribute('data-mode', 'park')
  await setGear(app, 'D')
  await expect(pane).toHaveAttribute('data-mode', 'drive')
  await expect(win.getByTestId('car-pane')).toContainText('MPH')
})

test("pages get the car's GPS position from navigator.geolocation", async () => {
  await navigate(app, win, `${siteA.url}/target.html`)
  await win.evaluate(() =>
    window.emulator.patchVehicle({ location: { lat: 37.4419, lng: -122.143, accuracy: 5, heading: 0, source: 'manual' } })
  )
  await expect
    .poll(() =>
      guestEval<string>(
        app,
        `new Promise((resolve) => navigator.geolocation.getCurrentPosition(
           (p) => resolve(p.coords.latitude.toFixed(4) + ',' + p.coords.longitude.toFixed(3)),
           (e) => resolve('error ' + e.code), { timeout: 5000 }))`
      )
    )
    .toBe('37.4419,-122.143')
})

test('switching to the pre-2026.26 firmware profile reports its metrics', async () => {
  const probeUrl = await app.evaluate(() => globalThis.__teslaEmulator.probeUrl())
  await navigate(app, win, probeUrl)
  await win.evaluate(() => window.emulator.patchSettings({ profileId: 'legacy' }))
  await expect.poll(() => guestEval(app, '[innerWidth, innerHeight, devicePixelRatio].join("x")')).toBe('1183x920x1')
  await guestEval(app, 'location.reload()')
  await expect.poll(() => guestEval<string>(app, 'navigator.userAgent')).toContain('Chrome/140.0.0.0')
  await win.evaluate(() => window.emulator.patchSettings({ profileId: '2026.26' }))
  await expect.poll(() => guestEval(app, '[innerWidth, innerHeight].join("x")')).toBe('773x601')
})

test('car viewport emulation comes back if another DevTools client resets it', async () => {
  await navigate(app, win, `${siteA.url}/target.html`)
  // What Playwright/Puppeteer screenshots or DevTools' device toolbar do to the page.
  await app.evaluate(() => globalThis.__teslaEmulator.guestContents()!.debugger.sendCommand('Emulation.clearDeviceMetricsOverride'))
  await expect.poll(() => guestEval(app, '[innerWidth, innerHeight, Math.round(devicePixelRatio * 100)].join("x")')).toBe('773x601x153')
})
