# tesla-web-dev

A [Claude Code](https://claude.com/claude-code) skill for building web apps for the **Tesla in-car browser**, and testing them in the [Tesla Emulator](https://github.com/mildchef/tesla-emulator) without going out to the car.

*Unofficial project, not affiliated with or endorsed by Tesla, Inc.*

## What it gives Claude

- **The car browser's facts and limits.** Chromium 148, a 773 × 601 viewport at DPR 1.53, and the media queries and user agent it reports. What stops working when the car isn't in Park: video picture, video pixel reads, fullscreen and camera. And what's always off: downloads, popups, zoom, and several permissions. Each fact is marked as measured, derived or unverified.
- **Design advice** that follows from those limits, such as touch-sized targets, no hover-only actions, audio-first features for driving, and redirect-based sign-in.
- **`emu`**, a command-line remote for the emulator, so Claude can test its own work:

```bash
emu start                  # launch the emulator if needed
emu open localhost:5173    # load your dev server in the car browser
emu shot screen            # screenshot of the whole car screen
emu gear D                 # shift into Drive: the driving restrictions apply
emu console --errors       # what the page logged
emu events                 # what the car browser blocked
```

Ask Claude to "check this in the Tesla emulator" or "make sure it works while driving", and it runs that loop and looks at the screenshots.

## Install

In Claude Code:

```
/plugin marketplace add mildchef/tesla-web-dev
/plugin install tesla-web-dev@tesla-web-dev
```

You also need the [Tesla Emulator](https://github.com/mildchef/tesla-emulator) and Node.js 18 or later:

```bash
git clone https://github.com/mildchef/tesla-emulator
```

The first time Claude runs `emu`, it asks where the emulator is and saves the location with `emu setup <dir>`. If you clone the emulator and use the skill from inside it, `emu` finds it on its own.

To install the skill by hand, copy `plugins/tesla-web-dev/skills/tesla-web-dev` to `~/.claude/skills/`.

## How `emu` talks to the emulator

The emulator runs a small control server on `127.0.0.1` only. It writes the server's port and a random token to `.emulator-data/control.json` in its folder, and `emu` reads both from there. Requests without the token are refused, and so are requests from web pages, including the one under test.

## About this repository

The skill is developed together with the emulator, and this repository is updated automatically from there. Pull requests can't be merged here, but issues are welcome.

## License

MIT. Tesla and Model 3 are trademarks of Tesla, Inc.
