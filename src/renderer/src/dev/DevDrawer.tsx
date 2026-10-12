import { useStore } from '../state/store'
import type { Gear, Theme } from '@shared/types'
import { resolveUserAgent } from '@shared/profiles'
import { PAINTS } from '../car3d/paints'
import styles from './DevDrawer.module.css'

const GEARS: Gear[] = ['P', 'R', 'N', 'D']

function time(t: number): string {
  return new Date(t).toLocaleTimeString('en-US', { hour12: false })
}

/** Developer controls, outside the Tesla screen. */
export function DevDrawer() {
  const s = useStore()
  const profile = s.profiles.find((p) => p.id === s.settings.profileId) ?? s.profiles[0]
  const ua = profile ? resolveUserAgent(profile, s.chromeVersion, s.settings.userAgentOverride) : ''
  const m = s.metrics
  const vp = profile ? (s.browserLayout === 'fullscreen' ? profile.screen : profile.viewport[s.browserLayout]) : null
  const matches =
    m && profile && vp
      ? m.innerWidth === vp.width && m.innerHeight === vp.height && Math.abs(m.devicePixelRatio - profile.devicePixelRatio) < 0.005
      : null

  return (
    <aside className={styles.drawer} data-testid="dev-drawer">
      <section>
        <h4>Gear</h4>
        <div className={styles.gears}>
          {GEARS.map((g) => (
            <button
              key={g}
              className={s.vehicle.gear === g ? styles.on : ''}
              onClick={() => s.setGear(g)}
              data-testid={`dev-gear-${g}`}
            >
              {g}
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          {s.vehicle.gear === 'P' ? 'Parked: no browser restrictions.' : 'Not in Park: video hidden (audio plays), fullscreen & camera blocked.'}
        </p>
        <label className={styles.check}>
          <input type="checkbox" checked={s.stripPinned} onChange={(e) => s.setStripPinned(e.target.checked)} />
          Always show drive mode strip
        </label>
      </section>

      <section>
        <h4>Page under test</h4>
        <div className={styles.row}>
          <button onClick={() => void window.emulator.openGuestDevTools()} data-testid="dev-open-devtools">
            Open DevTools
          </button>
          <button onClick={() => s.navigate(s.probeUrl)}>Open probe</button>
        </div>
        <dl className={styles.metrics}>
          <dt>Viewport</dt>
          <dd data-testid="dev-viewport">{m ? `${m.innerWidth} × ${m.innerHeight}` : '—'}</dd>
          <dt>DPR</dt>
          <dd>{m ? m.devicePixelRatio : '—'}</dd>
          <dt>Screen</dt>
          <dd>{m ? `${m.screenWidth} × ${m.screenHeight}` : '—'}</dd>
          <dt>Layout</dt>
          <dd>{s.browserLayout}</dd>
          <dt>Expected</dt>
          <dd className={matches === false ? styles.bad : ''}>
            {vp && profile ? `${vp.width} × ${vp.height} @ ${profile.devicePixelRatio}` : '—'}
            {matches === true && ' ✓'}
          </dd>
        </dl>
      </section>

      <section>
        <h4>Firmware profile</h4>
        <select value={s.settings.profileId} onChange={(e) => s.patchSettings({ profileId: e.target.value })} data-testid="dev-profile">
          {s.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {profile && <p className={styles.hint}>{profile.notes}</p>}
        <label className={styles.label}>User agent override</label>
        <textarea
          rows={3}
          placeholder={ua}
          value={s.settings.userAgentOverride}
          onChange={(e) => s.patchSettings({ userAgentOverride: e.target.value })}
          spellCheck={false}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={s.settings.touchInput} onChange={(e) => s.patchSettings({ touchInput: e.target.checked })} />
          Mouse sends touch events
        </label>
      </section>

      <section>
        <h4>Display</h4>
        <div className={styles.row}>
          {(['dark', 'light'] as Theme[]).map((t) => (
            <button key={t} className={s.settings.theme === t ? styles.on : ''} onClick={() => s.patchSettings({ theme: t })}>
              {t === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
        <label className={styles.label}>Paint</label>
        <div className={styles.swatches}>
          {PAINTS.map((p) => (
            <button
              key={p.id}
              title={p.name}
              className={s.settings.paint === p.id ? styles.swatchOn : ''}
              style={{ background: p.swatch }}
              onClick={() => s.patchSettings({ paint: p.id })}
            />
          ))}
        </div>
        <label className={styles.label}>Trim</label>
        <div className={styles.row}>
          <button className={s.settings.trim === 'performance' ? styles.on : ''} onClick={() => s.patchSettings({ trim: 'performance' })}>
            Performance
          </button>
          <button className={s.settings.trim === 'premium' ? styles.on : ''} onClick={() => s.patchSettings({ trim: 'premium' })}>
            Premium
          </button>
        </div>
      </section>

      <section className={styles.grow}>
        <h4>
          Guardrail log
          <button className={styles.clear} onClick={() => useStore.setState({ events: [] })}>
            clear
          </button>
        </h4>
        <ul className={styles.log} data-testid="dev-log">
          {s.events.map((e, i) => (
            <li key={`${e.time}-${i}`} data-kind={e.kind}>
              <time>{time(e.time)}</time>
              <span>{e.detail}</span>
            </li>
          ))}
        </ul>
        <button className={styles.danger} onClick={() => void window.emulator.clearBrowsingData()}>
          Clear browsing data
        </button>
      </section>

      <footer>
        Electron {s.electronVersion} · Chromium {s.chromeVersion}
      </footer>
    </aside>
  )
}
