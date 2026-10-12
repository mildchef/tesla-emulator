# Tesla Emulator

A desktop emulator of the **Tesla Model 3 Highland** center touchscreen, built to develop and test web apps for the Tesla in-car browser without going to the car.

*Unofficial project, not affiliated with or endorsed by Tesla, Inc.*

- The browser pane is a real Chromium 148 webview, the same engine the car runs since the 2026.26 update. Pages see the car's 773×601 CSS-px viewport at DPR 1.53, its 1254×784 screen, a Linux `TeslaBrowser` user agent with matching client hints, and the car's media features.
- Slide the on-screen gear selector into **Drive** (swipe up; down for Reverse, tap P to park, hold N for Neutral) and the browser applies the car's guardrails:
  - video freezes while its audio keeps playing
  - video pixels read back black
  - fullscreen and the camera are refused
  - the expanded browser collapses
- These guardrails also apply inside cross-origin iframes, such as a YouTube embed.

## Setup

On a Mac, double-click **Run Tesla Emulator.command** in Finder. The first run installs dependencies and builds the 3D car. To launch it from the Dock, drag the file onto the right side of the Dock. To do the same by hand:

```bash
npm install
npm run build:car   # optional: builds the 3D car if you have its model file (see below); re-run when scripts/build-car-model.mjs changes
npm run dev
```

Everything the emulator reads lives in this folder:

- **3D car:** built from Tesla's own Model 3 Highland visualization mesh, `vendor/tesla/model3-2024-base/vehicle.obj`. That file is Tesla's and isn't published under any license, so it isn't part of the public repository. If you have it, put it at that path and run `npm run build:car`. Without it, the car pane shows a 2D stand-in and everything else works the same.
- **Saved data:** settings, bookmarks, history and the test browser's cookies and storage are kept in `.emulator-data/` (git-ignored). Delete that folder to start fresh.
- **Font:** Montserrat, bundled from `node_modules`.

The only outside resources are online: the map tiles (CARTO), favicons on the new-tab page (Google), the IP location fallback (ipapi.co), and whatever sites you open in the browser.

## Using it

- **Load your app:** start your dev server as usual and type its address, such as `localhost:5173` or `192.168.1.20:3000`, in the browser's address bar. Local addresses open over plain `http://`. Chromium treats `localhost` and `127.0.0.1` as secure, so geolocation and the camera work there; on a LAN address they need HTTPS, as in the car. The emulator's own UI runs on port 47173 in dev mode, so it doesn't take your app's port.
- **Dev drawer (⌘. or the DEV tab):**
  - gear buttons
  - DevTools for the page under test
  - live viewport/DPR readout
  - firmware profile (2026.26+ or pre-2026.26)
  - user agent override
  - theme, paint and trim
  - a log of every guardrail that fired
- **Vehicle menu:** ⌘⇧P / ⌘⇧R / ⌘⇧N / ⌘⇧D shift gears.
- **Probe page:** the new-tab page links a probe that lists everything the browser exposes. To open it in your car, run `npm run probe:lan` with the car on the same Wi-Fi, then enter the printed address in the car's browser. Compare the numbers and tune `src/shared/profiles.ts`.
- **Map:** follows your location (macOS Location Services, falling back to an IP lookup via ipapi.co). Right-click the map to place the car anywhere. Pages in the browser get that position from `navigator.geolocation`, as they would from the car's GPS.

## Testing with Claude Code

The [tesla-web-dev](https://github.com/mildchef/tesla-web-dev) skill teaches Claude Code the car browser's limits. Its `emu` CLI lets Claude drive this emulator from any project: open your dev server, shift into Drive, take screenshots, run code in the page and read its console. The skill's source is in `packages/tesla-web-dev`.

While the emulator runs, it serves a control API on `127.0.0.1` that `emu` uses. Its port and a random token are in `.emulator-data/control.json`. Requests without the token are refused, and so are requests from web pages.

## Tests

```bash
npm run typecheck
npm test            # builds, then runs the Playwright/Electron e2e suite
```

## About this repository

Development happens in a private repository, and this one is updated automatically after every change. Pull requests can't be merged here, but issues are welcome.

## License

The code is MIT licensed (see [LICENSE](LICENSE)). Tesla, Model 3 and the Tesla in-car interface are trademarks of Tesla, Inc.; this project only imitates the interface for testing web apps.
