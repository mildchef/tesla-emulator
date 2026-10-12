/**
 * Runs in the page's MAIN world of every frame, before page scripts, via
 * contextBridge.executeInMainWorld. Electron serializes this function with
 * toString(), so it must be fully self-contained: no imports, no references to
 * module scope.
 *
 * Emulates the Tesla browser's behavior when the car is not in Park:
 *  - <video> keeps playing (audio continues) but the picture freezes on the last
 *    frame, or shows black if no frame was ever shown.
 *  - Reading video pixels (2D canvas, createImageBitmap, WebGL) yields black.
 *  - Element fullscreen is exited and requestFullscreen() rejects.
 *  - Camera capture is refused, and live camera tracks end on shifting out of Park.
 */
export interface GuardrailsApi {
  setGear: (gear: string) => void
}

export function installGuardrails(
  initialGear: string,
  deviceMemory: number,
  report: (kind: string, detail: string) => void
): GuardrailsApi {
  const w = window as unknown as Record<string, unknown>
  const INSTALLED = '__teslaGuardrailsInstalled'
  if (w[INSTALLED]) return { setGear: () => undefined }
  Object.defineProperty(w, INSTALLED, { value: true, enumerable: false })

  let gear = initialGear
  const driving = (): boolean => gear !== 'P'

  // Keep pristine references before anything on the page can patch them.
  const native = {
    drawImage: CanvasRenderingContext2D.prototype.drawImage,
    createImageBitmap: window.createImageBitmap?.bind(window),
    requestFullscreen: Element.prototype.requestFullscreen,
    webkitRequestFullscreen: (Element.prototype as unknown as Record<string, unknown>).webkitRequestFullScreen as
      | ((this: Element) => void)
      | undefined,
    exitFullscreen: Document.prototype.exitFullscreen,
    getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
    play: HTMLMediaElement.prototype.play,
    attachShadow: Element.prototype.attachShadow
  }

  const say = (kind: string, detail: string): void => {
    try {
      report(kind, detail)
    } catch {
      // the isolated world went away (frame navigating)
    }
  }

  // ---------------------------------------------------------------- deviceMemory
  try {
    Object.defineProperty(Navigator.prototype, 'deviceMemory', {
      configurable: true,
      enumerable: true,
      get: () => deviceMemory
    })
  } catch {
    // not configurable in this frame
  }

  // The car browser has no window chrome around the page.
  try {
    Object.defineProperty(window, 'outerWidth', { configurable: true, get: () => window.innerWidth })
    Object.defineProperty(window, 'outerHeight', { configurable: true, get: () => window.innerHeight })
  } catch {
    // ignore
  }

  // ---------------------------------------------------------------- video tracking
  const videos = new Set<HTMLVideoElement>()
  type Saved = { props: Record<string, [string, string]>; url: string | null }
  const frozen = new Map<HTMLVideoElement, Saved>()

  const track = (el: unknown): void => {
    if (el instanceof HTMLVideoElement && !videos.has(el)) {
      videos.add(el)
      if (driving()) freeze(el)
    }
  }

  const scan = (root: ParentNode): void => {
    root.querySelectorAll?.('video').forEach(track)
  }

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLVideoElement) track(n)
        else if (n instanceof Element) scan(n)
      })
    }
  })
  const observe = (root: Node): void => observer.observe(root, { childList: true, subtree: true })

  Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
    const shadow = native.attachShadow.call(this, init)
    try {
      observe(shadow)
    } catch {
      // ignore
    }
    return shadow
  }

  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement): Promise<void> {
    track(this)
    return native.play.call(this)
  }

  for (const type of ['play', 'playing', 'loadeddata', 'loadedmetadata']) {
    window.addEventListener(type, (e) => track(e.target), true)
  }

  const startObserving = (): void => {
    observe(document)
    scan(document)
  }
  if (document.documentElement) startObserving()
  else document.addEventListener('readystatechange', startObserving, { once: true })

  // ---------------------------------------------------------------- freeze / thaw
  // The frozen frame is painted as the element's background, sized like the video
  // content; the live picture is pushed outside the (clipped) content box. Audio
  // and the element's playback state are untouched.
  const FREEZE_PROPS = ['background', 'object-position']

  const backgroundSize = (fit: string): string => {
    switch (fit) {
      case 'cover':
        return 'cover'
      case 'fill':
        return '100% 100%'
      case 'none':
        return 'auto'
      default:
        return 'contain'
    }
  }

  const snapshot = (v: HTMLVideoElement): string | null => {
    if (!v.videoWidth || !v.videoHeight || v.readyState < 2) return null
    try {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      const ctx = c.getContext('2d')
      if (!ctx) return null
      ;(native.drawImage as (...a: unknown[]) => void).call(ctx, v, 0, 0)
      return c.toDataURL('image/jpeg', 0.85)
    } catch {
      // cross-origin (tainted) video: fall back to black
      return null
    }
  }

  function freeze(v: HTMLVideoElement): void {
    if (frozen.has(v)) return
    const style = v.style
    const saved: Saved = { props: {}, url: null }
    for (const p of FREEZE_PROPS) saved.props[p] = [style.getPropertyValue(p), style.getPropertyPriority(p)]
    const computed = getComputedStyle(v)
    const url = snapshot(v)
    saved.url = url
    const position = computed.objectPosition || '50% 50%'
    const image = url ? `url("${url}") ${position} / ${backgroundSize(computed.objectFit)} no-repeat, ` : ''
    style.setProperty('background', `${image}#000`, 'important')
    style.setProperty('object-position', '-100000px -100000px', 'important')
    frozen.set(v, saved)
  }

  function thaw(v: HTMLVideoElement): void {
    const saved = frozen.get(v)
    if (!saved) return
    for (const p of FREEZE_PROPS) {
      const [value, priority] = saved.props[p]
      if (value) v.style.setProperty(p, value, priority)
      else v.style.removeProperty(p)
    }
    frozen.delete(v)
  }

  // ---------------------------------------------------------------- pixel reads
  const isVideo = (src: unknown): boolean =>
    src instanceof HTMLVideoElement || (typeof VideoFrame !== 'undefined' && src instanceof VideoFrame)

  const blackCanvas = (wd: number, ht: number): HTMLCanvasElement => {
    const c = document.createElement('canvas')
    c.width = Math.max(1, wd | 0)
    c.height = Math.max(1, ht | 0)
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, c.width, c.height)
    }
    return c
  }

  let pixelNoticeAt = 0
  const pixelNotice = (what: string): void => {
    const now = Date.now()
    if (now - pixelNoticeAt > 2000) {
      pixelNoticeAt = now
      say('pixels', `${what}(video) returned a black frame while driving`)
    }
  }

  const sizeOf = (src: HTMLVideoElement | VideoFrame): [number, number] =>
    src instanceof HTMLVideoElement ? [src.videoWidth || src.width || 1, src.videoHeight || src.height || 1] : [src.displayWidth, src.displayHeight]

  CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    if (driving() && isVideo(args[0])) {
      const [wd, ht] = sizeOf(args[0] as HTMLVideoElement)
      args[0] = blackCanvas(wd, ht)
      pixelNotice('drawImage')
    }
    return (native.drawImage as (...a: unknown[]) => void).apply(this, args)
  } as typeof CanvasRenderingContext2D.prototype.drawImage

  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
    const offDraw = OffscreenCanvasRenderingContext2D.prototype.drawImage
    OffscreenCanvasRenderingContext2D.prototype.drawImage = function (
      this: OffscreenCanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      if (driving() && isVideo(args[0])) {
        const [wd, ht] = sizeOf(args[0] as HTMLVideoElement)
        args[0] = blackCanvas(wd, ht)
        pixelNotice('drawImage')
      }
      return (offDraw as (...a: unknown[]) => void).apply(this, args)
    } as typeof OffscreenCanvasRenderingContext2D.prototype.drawImage
  }

  if (native.createImageBitmap) {
    const cib = native.createImageBitmap
    window.createImageBitmap = function (...args: unknown[]): Promise<ImageBitmap> {
      if (driving() && isVideo(args[0])) {
        const [wd, ht] = sizeOf(args[0] as HTMLVideoElement)
        args[0] = blackCanvas(wd, ht)
        pixelNotice('createImageBitmap')
      }
      return (cib as (...a: unknown[]) => Promise<ImageBitmap>)(...args)
    } as typeof window.createImageBitmap
  }

  const patchGL = (proto: WebGLRenderingContext | WebGL2RenderingContext | undefined): void => {
    if (!proto) return
    for (const name of ['texImage2D', 'texSubImage2D'] as const) {
      const orig = proto[name] as unknown as (...a: unknown[]) => void
      ;(proto as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        const i = args.findIndex(isVideo)
        if (driving() && i >= 0) {
          const [wd, ht] = sizeOf(args[i] as HTMLVideoElement)
          args[i] = blackCanvas(wd, ht)
          pixelNotice(name)
        }
        return orig.apply(this, args)
      }
    }
  }
  patchGL(window.WebGLRenderingContext?.prototype)
  patchGL(window.WebGL2RenderingContext?.prototype)

  // ---------------------------------------------------------------- fullscreen
  const fullscreenError = (): DOMException =>
    new DOMException('Fullscreen is not available while the car is not in Park.', 'NotAllowedError')

  Element.prototype.requestFullscreen = function (this: Element, options?: FullscreenOptions): Promise<void> {
    if (driving()) {
      say('fullscreen', `requestFullscreen() blocked on <${this.tagName.toLowerCase()}> while driving`)
      document.dispatchEvent(new Event('fullscreenerror', { bubbles: true }))
      return Promise.reject(fullscreenError())
    }
    return native.requestFullscreen.call(this, options)
  }
  if (native.webkitRequestFullscreen) {
    const legacy = function (this: Element): void {
      if (driving()) {
        say('fullscreen', 'webkitRequestFullscreen() blocked while driving')
        return
      }
      native.webkitRequestFullscreen?.call(this)
    }
    const proto = Element.prototype as unknown as Record<string, unknown>
    proto.webkitRequestFullScreen = legacy
    proto.webkitRequestFullscreen = legacy
  }

  const exitFullscreenNow = (): void => {
    if (document.fullscreenElement) {
      native.exitFullscreen.call(document).catch(() => undefined)
      say('fullscreen', 'Exited fullscreen on shifting out of Park')
    }
  }

  // ---------------------------------------------------------------- camera
  const liveCameraTracks = new Set<MediaStreamTrack>()
  const wantsVideo = (c?: MediaStreamConstraints): boolean => !!c && !!c.video

  if (native.getUserMedia && navigator.mediaDevices) {
    const gum = native.getUserMedia
    navigator.mediaDevices.getUserMedia = function (constraints?: MediaStreamConstraints): Promise<MediaStream> {
      if (driving() && wantsVideo(constraints)) {
        say('camera', 'getUserMedia({video}) refused: the camera is only available in Park')
        return Promise.reject(new DOMException('The camera is only available while parked.', 'NotAllowedError'))
      }
      return gum(constraints).then((stream) => {
        for (const t of stream.getVideoTracks()) {
          liveCameraTracks.add(t)
          t.addEventListener('ended', () => liveCameraTracks.delete(t))
        }
        return stream
      })
    }
  }

  const stopCamera = (): void => {
    if (!liveCameraTracks.size) return
    for (const t of liveCameraTracks) {
      t.stop()
      // stop() does not fire 'ended' on the stopping side; pages listen for it.
      t.dispatchEvent(new Event('ended'))
    }
    liveCameraTracks.clear()
    say('camera', 'Camera stopped on shifting out of Park')
  }

  // ---------------------------------------------------------------- gear changes
  const apply = (): void => {
    if (driving()) {
      exitFullscreenNow()
      stopCamera()
      scan(document)
      videos.forEach((v) => freeze(v))
      if (videos.size) say('video', `${videos.size} video(s) hidden while driving; audio continues`)
    } else {
      frozen.forEach((_s, v) => thaw(v))
    }
  }

  if (driving()) apply()

  return {
    setGear(next: string): void {
      if (next === gear) return
      const was = driving()
      gear = next
      if (was !== driving()) apply()
    }
  }
}
