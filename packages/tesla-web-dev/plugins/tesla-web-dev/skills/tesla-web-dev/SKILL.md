---
name: tesla-web-dev
description: Build, debug and test web apps for the Tesla in-car browser (the Model 3/Y touchscreen browser), and test them in the Tesla Emulator. Use when the user is making a site or web app meant to run in a Tesla, mentions the Tesla browser, its screen size or user agent, Drive-mode video blocking, or asks to check how something looks or behaves in the car or the emulator.
---

# Tesla web development

The car's browser is Chromium with car-specific limits. The Tesla Emulator reproduces it on a Mac or PC, and the bundled `emu` CLI lets you drive the emulator: open the app, shift gears, take screenshots, run code in the page and read its console. Use it to check your work instead of guessing.

## The car browser in brief

Since the 2026.26 software update (most cars as of late 2026):

| | Value |
|---|---|
| Engine | Chromium 148 |
| Viewport, split view (the default: car on the left, browser on the right) | **773 × 601** CSS px |
| Viewport, expanded (Park only) | 1254 × 601 (derived, not measured) |
| `devicePixelRatio` | **1.53** |
| `screen` | 1254 × 784 |
| Media queries | `pointer: fine`, `hover: hover`, `prefers-color-scheme: light` |
| `navigator.deviceMemory` | 2 |
| User agent | Linux desktop Chrome plus `TeslaBrowser/<version>` (exact string unverified) |

Cars without that update report Chrome 140, DPR 1, a 1183 × 920 viewport, `pointer: coarse`, `hover: none` and dark mode. Full details, sources and confidence levels: [references/car-browser.md](references/car-browser.md).

**Whenever the car is not in Park (R, N or D):**
- Videos keep playing and **their audio continues**, but the picture freezes on the last frame. A video started while driving shows black.
- Reading video pixels (`drawImage`, `createImageBitmap`, WebGL textures) returns black.
- Fullscreen is exited and `requestFullscreen()` rejects.
- The camera is refused, and live camera tracks end when the car shifts out of Park. The microphone keeps working.
- The expanded browser collapses back to split view.

**Always:**
- No downloads.
- `window.open` and `target=_blank` load in the same, single tab.
- No page zoom.
- Geolocation is granted (the car's GPS).
- Camera and microphone ask the user.
- Notifications, USB, HID, serial and MIDI are denied.

Pages can't tell whether the car is moving.

## Designing for it

- **Lay out for 773 × 601 first.** It's short and wide, so keep the main actions in view without scrolling. Check 1254 × 601 too.
- **Treat it as a touchscreen,** even though it reports `pointer: fine` and `hover: hover`. Make targets at least 48 CSS px. Never put an action behind hover alone. Use Pointer Events, which work for both touch and mouse.
- **Don't take the theme from `prefers-color-scheme`:** it reports `light` even when the car's screen is dark. Offer a theme toggle, or default to dark.
- **DPR is fractional (1.53):** 1px borders and canvas pixels don't land on whole device pixels. Size canvases from `devicePixelRatio` and round. Ship images at 2×.
- **Make anything usable while driving work through audio.** Video, camera and canvas-from-video features are Park-only.
- **Handle the refusals:** catch `requestFullscreen()` and `getUserMedia()` rejections, and listen for a camera track's `ended` event.
- **Avoid popups and new tabs.** Sign-in popups (OAuth) break in a single-tab browser, so use redirect flows. Don't rely on downloads: offer a link, QR code or email instead.
- **Keep memory use modest** (`deviceMemory` 2). Don't gate features on the user agent alone, since its format isn't confirmed.

## Testing in the emulator

`emu` is `scripts/emu.mjs` next to this file. Run it with Node 18+: `node <this skill's folder>/scripts/emu.mjs <command>`. All commands: [references/emu.md](references/emu.md).

1. **Start the app's dev server** the usual way, and note its address (for example `localhost:5173`).
2. **`emu start`** starts the emulator if it isn't running and waits until it's ready. The first run can take a few minutes. If emu says it can't find the emulator, ask the user where it is (then `emu setup <dir>`), or offer to clone https://github.com/mildchef/tesla-emulator.
3. **`emu open localhost:5173`** loads the app as if it were typed in the car's address bar. Local addresses open over `http://`. Only `localhost` and `127.0.0.1` count as secure there, so the camera and geolocation need HTTPS on a LAN address.
4. **Look at it.**
   - `emu shot screen` captures the whole car screen. `emu shot page` captures just the web page at the car's resolution.
   - Both print a PNG path. Open it with your image-reading tool and check the layout at 773 × 601: clipping, overflow, tiny text or targets, hover-only controls.
5. **Check for errors:** `emu console --errors` after each load and interaction.
6. **Interact:** use `emu eval "<js>"`, for example `document.querySelector('#play').click()`. It runs as a user gesture, so it can start audio or request fullscreen.
7. **Test driving:**
   - `emu gear D`, then repeat the checks. Video should freeze while audio continues, and fullscreen and camera should fail gracefully.
   - `emu events` lists what the guardrails blocked.
   - Then `emu gear P`.
8. **Test expanded view:** `emu layout expanded` (Park only), then `emu layout split`.
9. **Test older cars:** `emu set profile=legacy`, then `emu reload`. Afterwards, `emu set profile=2026.26` and `emu reload`.

**When you finish:**
- Put the car back in P, split view and the 2026.26 profile.
- Leave the emulator running.
- Report what you checked, with the screenshot paths.

**Testing in the real car:** `localhost` in the car means the car itself. Start the dev server so it accepts LAN connections (for Vite, `--host`). Then open the computer's LAN address, such as `192.168.1.20:5173`, in the car.

The emulator's own probe page lists everything the browser reports. `emu probe` prints it as JSON. Opening it in the real car is how you'd confirm the numbers above.
