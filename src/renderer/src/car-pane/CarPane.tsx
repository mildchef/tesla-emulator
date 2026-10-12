import { lazy, Suspense } from 'react'
import { useStore } from '../state/store'
import { Battery, PRND } from '../screen/StatusBar'
import { MediaCard } from './MediaCard'
import styles from './CarPane.module.css'

const CarStage = lazy(() => import('../car3d/CarStage').then((m) => ({ default: m.CarStage })))

function DriveOverlay() {
  const speed = useStore((s) => s.vehicle.speedMph)
  return (
    <div className={styles.speed}>
      <b>{Math.round(speed)}</b>
      <span>MPH</span>
    </div>
  )
}

/** Left pane: 3D car in Park, driving visualization otherwise. */
export function CarPane() {
  const gear = useStore((s) => s.vehicle.gear)
  const stripPinned = useStore((s) => s.stripPinned)
  const parked = gear === 'P'
  return (
    <div
      className={`${styles.pane} ${!parked || stripPinned ? styles.withStrip : ''}`}
      data-testid="car-pane"
      data-mode={parked ? 'park' : 'drive'}
    >
      <Suspense fallback={null}>
        <CarStage mode={parked ? 'park' : 'drive'} />
      </Suspense>
      <div className={styles.topRow}>
        <PRND />
        <Battery />
      </div>
      {!parked && <DriveOverlay />}
      {parked && <MediaCard />}
      {parked && (
        <div className={styles.pageDots}>
          <i className={styles.dotActive} />
          <i />
          <i />
        </div>
      )}
    </div>
  )
}
