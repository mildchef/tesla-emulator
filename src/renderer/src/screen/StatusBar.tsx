import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { CloudSun, Lock, Person } from '../icons'
import styles from './StatusBar.module.css'

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function PRND({ className }: { className?: string }) {
  const gear = useStore((s) => s.vehicle.gear)
  return (
    <div className={`${styles.prnd} ${className ?? ''}`} data-testid="prnd">
      {(['P', 'R', 'N', 'D'] as const).map((g) => (
        <span key={g} className={g === gear ? styles.gearActive : undefined}>
          {g}
        </span>
      ))}
    </div>
  )
}

export function Battery({ percent = 86 }: { percent?: number }) {
  return (
    <div className={styles.battery}>
      <span>{percent}%</span>
      <span className={styles.batteryShell}>
        <span className={styles.batteryFill} style={{ width: `${percent}%` }} />
      </span>
    </div>
  )
}

/** Status bar along the top of the right pane (lock, clock, weather, airbag). */
export function StatusBar({ showVehicleSummary }: { showVehicleSummary: boolean }) {
  const locked = useStore((s) => s.vehicle.locked)
  const patchVehicle = useStore((s) => s.patchVehicle)
  const time = useClock()
  return (
    <div className={styles.bar} data-testid="status-bar">
      {showVehicleSummary && (
        <div className={styles.summary}>
          <PRND />
          <Battery />
        </div>
      )}
      <button className={styles.lock} onClick={() => patchVehicle({ locked: !locked })} aria-label="Lock">
        <Lock size={28} open={!locked} />
      </button>
      <span className={styles.time}>{time}</span>
      <span className={styles.weather}>
        <CloudSun size={32} />
        72°F
      </span>
      <span className={styles.aqi}>
        AQI <b>64</b>
      </span>
      <span className={styles.profile}>
        <Person size={26} />
        Profile
      </span>
      <span className={styles.airbag}>
        <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
          <circle cx="8" cy="5" r="2.2" fill="#ffb03b" />
          <path d="M6.5 8.5h3l1.2 5H15l1.5 5" stroke="#ffb03b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M15 4.5a4 4 0 0 1 4 4" stroke="#ffb03b" strokeWidth="1.6" fill="none" />
          <text x="18" y="21" fontSize="7" fill="#ffb03b" fontWeight="700">2</text>
        </svg>
        <span>
          PASSENGER
          <br />
          AIRBAG <em>OFF</em>
        </span>
      </span>
    </div>
  )
}
