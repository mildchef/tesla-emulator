# The Tesla in-car browser: reference

These are community measurements and testing as of October 2026, as reproduced by the Tesla Emulator. Tesla doesn't publish a spec, so each item says how sure it is.

## What pages see

### Current firmware (2026.26 and later)

| Property | Value | Confidence |
|---|---|---|
| Engine | Chromium 148 | Measured |
| Viewport, split view | 773 × 601 CSS px | Measured on a car |
| Viewport, expanded browser (Park only) | 1254 × 601 | Derived from the panel width and DPR |
| Viewport, element fullscreen (Park only) | 1254 × 784 | Derived: the whole screen |
| `devicePixelRatio` | 1.53 | Measured |
| `screen.width/height` | 1254 × 784 | Measured |
| `pointer` / `hover` | `fine` / `hover` | Measured; changed in 2026.26 |
| `prefers-color-scheme` | `light`, regardless of the car's theme | Measured; changed in 2026.26 |
| `navigator.deviceMemory` | 2 | Measured |
| User agent | `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 TeslaBrowser/148.0.7778.x` | Format from earlier cars; the exact current string is unverified |
| Client hints | Platform `Linux`, not mobile | Assumed to match the user agent |

The physical panel is 1920 × 1200. In split view the browser occupies 1183 × 920 panel pixels, which is 773 × 601 at DPR 1.53.

Some sites serve their tablet or mobile layout at this size. YouTube, for example, serves m.youtube.com.

### Older firmware (before 2026.26)

| Property | Value |
|---|---|
| User agent | Chrome 140 (`TeslaBrowser/140.0.7339.207`) |
| `devicePixelRatio` | 1 |
| `screen` | 1920 × 1200 |
| Viewport, split view | about 1183 × 920 |
| Viewport, expanded | about 1920 × 920 |
| `pointer` / `hover` | `coarse` / `none` |
| `prefers-color-scheme` | `dark` |
| `deviceMemory` | 1 |

The emulator renders this profile with its Chromium 148 engine. Only the reported values change.

## Restrictions while not in Park (R, N, D)

These come from 2026 owner testing. Some older firmware reportedly paused the audio as well.

- **Video:** `<video>` keeps playing (`paused === false`, `currentTime` advances) and its audio continues, but the picture freezes on the last frame shown. A video that never showed a frame stays black. This applies in cross-origin iframes too, such as embedded YouTube players.
- **Pixel reads:** `CanvasRenderingContext2D.drawImage(video)`, `OffscreenCanvas`, `createImageBitmap(video)` and WebGL `texImage2D`/`texSubImage2D(video)` produce black. Canvas tricks don't get around the video block.
- **Fullscreen:** an element in fullscreen exits it, and `requestFullscreen()` rejects.
- **Camera:** `getUserMedia({ video })` rejects. Camera tracks that are already live end, and their `ended` event fires. Microphone-only capture keeps working.
- **Layout:** the expanded browser collapses to split view, and expanding isn't possible.

Pages get no event or API that says the car is driving. Design so the experience works either way.

## Always on

| Feature | Behaviour |
|---|---|
| Downloads | Cancelled. The user sees nothing. |
| `window.open`, `target=_blank` | Opens in the same view; there is one tab |
| Page zoom | Unavailable: pinch and keyboard zoom are blocked |
| Geolocation | Granted, from the car's GPS |
| Camera / microphone | The user is asked (camera only in Park) |
| Notifications, Web USB, HID, Serial, MIDI | Denied |
| Autoplay with sound | Needs a user gesture, as in desktop Chrome |
| Storage and cookies | Persistent across drives (one profile) |

## Practical consequences

- **Feature detection works.** Everything above is ordinary Chromium behaviour with features switched off or denied. Detect features and handle rejections; don't sniff the browser.
- **Detecting the car:** `navigator.userAgent.includes('TeslaBrowser/')` is the best available signal, but treat it as a hint.
- **Testing on the car:** `localhost` there is the car. Serve on the LAN and open the computer's IP address. Plain-HTTP LAN pages load, but they aren't secure contexts, so the camera, microphone and geolocation need HTTPS. That's standard Chromium, and the emulator behaves the same: only `localhost` and `127.0.0.1` count as secure over HTTP.
