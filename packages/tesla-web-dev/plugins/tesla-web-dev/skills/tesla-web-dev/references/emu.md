# emu command reference

`node scripts/emu.mjs <command> [args] [--json]`

Each command prints a short readable result. With `--json` it prints the raw response instead. It exits with status 1 and a one-line message when something fails, such as the emulator not running, a load failing or a script throwing.

| Command | What it does |
|---|---|
| `setup <dir>` | Remembers where the emulator checkout is (saved in `~/.config/tesla-web-dev/config.json`). Only needed when emu can't find it on its own. |
| `start` | Starts the emulator in the background if it isn't running, waits until its browser is ready (up to 4 minutes on a first run), then prints the status. Its log is `.emulator-data/emulator.log` in the emulator folder. |
| `stop` | Quits the emulator. Only do this if the user asks. |
| `status` | Gear, layout, viewport, DPR, screen, firmware profile, and the open page with its URL, title and loading state. |
| `open <address>` | Loads an address as if typed in the address bar: `localhost:3000`, `192.168.1.20:5173/path`, `example.com`, or a full URL. Waits for the load and reports failures, such as a dev server that isn't running. |
| `reload`, `back`, `forward` | Like the toolbar buttons. Each waits for the load. |
| `gear <P\|R\|N\|D>` | Shifts. Anything but P turns on the driving restrictions in every frame of the page. |
| `layout <split\|expanded>` | Browser size: split is 773 × 601, expanded is 1254 × 601. Expanded works only in Park, and a note says so otherwise. |
| `shot [page\|screen] [--out file.png]` | Screenshot. `page` captures the web page alone, at the car's device-pixel resolution. `screen` captures the whole car display, including the car pane, status bar and dock. Prints the PNG's path; without `--out` it saves to a temp folder. |
| `eval <js>` | Runs JavaScript in the page's top frame as a user gesture, awaits promises, and prints the result as JSON. Return plain data (strings, numbers, arrays, objects), not DOM nodes. |
| `console [--errors] [--since n] [--clear]` | The page's console messages, failed loads and crashes, oldest first. `--json` includes `next`; pass it as `--since` to see only newer entries. |
| `events [--since ms]` | The guardrail log: shifts, frozen videos, blocked fullscreen, camera, downloads, popups, zoom and permissions. `--since` takes a Unix time in milliseconds. |
| `set key=value …` | `theme=dark\|light` (the car's own UI only; pages see the firmware profile's color scheme, `light` on 2026.26), `profile=2026.26\|legacy`, `touch=on\|off` (deliver touch events instead of mouse events), `muted=on\|off`, `ua=<string>` (empty to reset). Reload after changing `profile`, `touch` or `ua`. |
| `probe` | Opens the emulator's probe page and prints what the browser reports: sizes, DPR, media queries, user agent, features and codecs. |
| `devtools` | Opens Chrome DevTools for the page, for the user to inspect. |

## Recipes

Check that nothing overflows the car's viewport:

```bash
emu eval "[...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.tagName + (e.id ? '#' + e.id : '')).slice(0, 20)"
```

Find touch targets smaller than 48 CSS px:

```bash
emu eval "[...document.querySelectorAll('a,button,input,select,[role=button]')].map(e => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width && (r.width < 48 || r.height < 48)).map(([e, r]) => (e.textContent.trim() || e.getAttribute('aria-label') || e.tagName).slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)).slice(0, 30)"
```

Check video behaviour in Drive:

```bash
emu eval "document.querySelector('video').play()"   # a user gesture, so sound is allowed
emu gear D
emu eval "(() => { const v = document.querySelector('video'); return { paused: v.paused, time: v.currentTime } })()"
# wait a moment and run it again: time should keep increasing while the picture stays frozen
emu shot page
emu gear P
```

Watch for new console errors after an action:

```bash
emu console --clear
emu eval "document.querySelector('#submit').click()"
emu console --errors
```
