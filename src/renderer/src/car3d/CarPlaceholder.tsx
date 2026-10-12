import { useStore } from '../state/store'
import { Bolt, Lock } from '../icons'
import styles from './CarPlaceholder.module.css'

/** Fixed-position frunk/trunk/lock labels for the 2D stand-in car. */
function ParkOverlay() {
  const { locked, frunkOpen, trunkOpen } = useStore((s) => s.vehicle)
  const patchVehicle = useStore((s) => s.patchVehicle)
  return (
    <div className={styles.overlay}>
      <button className={styles.label} style={{ left: 182, top: 438, height: 130 }} onClick={() => patchVehicle({ frunkOpen: !frunkOpen })}>
        <span>{frunkOpen ? 'Close' : 'Open'}</span>
        <b>Frunk</b>
      </button>
      <button
        className={styles.lockLabel}
        style={{ left: 362, top: 300 }}
        onClick={() => patchVehicle({ locked: !locked })}
        aria-label={locked ? 'Unlock' : 'Lock'}
        data-testid="car-lock"
      >
        <Lock size={34} open={!locked} />
        <i style={{ height: 120 }} />
      </button>
      <button className={styles.label} style={{ left: 575, top: 335, height: 140 }} onClick={() => patchVehicle({ trunkOpen: !trunkOpen })}>
        <span>{trunkOpen ? 'Close' : 'Open'}</span>
        <b>Trunk</b>
      </button>
      <span className={styles.bolt} style={{ left: 668, top: 466 }}>
        <Bolt size={36} />
      </span>
    </div>
  )
}


/**
 * 2D stand-in shown when Tesla's 3D model hasn't been built (npm run build:car),
 * e.g. in CI. Draws a 3/4 silhouette in park and a road in drive.
 */
export function CarPlaceholder({ mode }: { mode: 'park' | 'drive' }) {
  if (mode === 'drive') {
    return (
      <div className={styles.road} data-testid="car-placeholder">
        <svg viewBox="0 0 737 1085" width="737" height="1085" aria-hidden>
          <defs>
            <linearGradient id="road-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--fg-3)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--fg-3)" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M330 300 L60 1085 M407 300 L677 1085" stroke="url(#road-g)" strokeWidth="5" fill="none" />
          <path d="M368 300 L368 1085" stroke="url(#road-g)" strokeWidth="4" strokeDasharray="40 50" fill="none" />
          <g transform="translate(368 760)">
            <rect x="-95" y="-60" width="190" height="150" rx="38" fill="var(--fg-3)" opacity="0.65" />
            <rect x="-70" y="-48" width="140" height="56" rx="18" fill="var(--screen-bg)" opacity="0.8" />
            <rect x="-88" y="40" width="40" height="12" rx="4" fill="#e82127" />
            <rect x="48" y="40" width="40" height="12" rx="4" fill="#e82127" />
          </g>
        </svg>
      </div>
    )
  }
  return (
    <>
      <div className={styles.park} data-testid="car-placeholder">
        <svg viewBox="0 0 600 340" width="600" height="340" aria-hidden>
          <ellipse cx="300" cy="300" rx="270" ry="30" fill="#000" opacity="0.35" />
          <path
            d="M40 230 C40 190 70 175 120 168 L210 120 C250 98 330 92 400 100 C450 106 500 130 540 165 C565 180 575 205 572 232 L560 262 L60 262 Z"
            fill="var(--fg-3)"
            opacity="0.75"
          />
          <path d="M225 125 C270 108 340 104 395 110 L455 150 L190 158 Z" fill="var(--screen-bg)" opacity="0.7" />
          <circle cx="150" cy="262" r="42" fill="#111" />
          <circle cx="470" cy="262" r="42" fill="#111" />
          <circle cx="150" cy="262" r="26" fill="#3a3a3e" />
          <circle cx="470" cy="262" r="26" fill="#3a3a3e" />
        </svg>
      </div>
      <ParkOverlay />
    </>
  )
}
