import { useEffect, useRef, useState } from 'react'
import type { Gear } from '@shared/types'
import { useStore } from '../state/store'
import { ArrowDown, ArrowUp, CarTop } from '../icons'
import { playShiftChime } from '../sound/chime'
import styles from './DriveModeStrip.module.css'

/** Swipe distance (panel px) that selects Drive (up) or Reverse (down). */
const SWIPE_THRESHOLD = 90
const MAX_TRAVEL = 230
const HOLD_MS = 700
const REST: Partial<Record<Gear, number>> = { D: -190, R: 190 }

interface Drag {
  pointerId: number
  startY: number
  /** Window px per panel px: the stage is CSS-scaled to fit the window. */
  scale: number
  dy: number
}

function targetGear(dy: number): Gear | null {
  if (dy <= -SWIPE_THRESHOLD) return 'D'
  if (dy >= SWIPE_THRESHOLD) return 'R'
  return null
}

/**
 * Highland touchscreen drive mode strip: swipe up for Drive, down for Reverse,
 * tap P for Park, press and hold N for Neutral.
 */
export function DriveModeStrip() {
  const gear = useStore((s) => s.vehicle.gear)
  const pinned = useStore((s) => s.stripPinned)
  const [hover, setHover] = useState(false)
  const [dragDy, setDragDy] = useState<number | null>(null)
  const [holdN, setHoldN] = useState(false)
  const drag = useRef<Drag | null>(null)
  const detach = useRef<(() => void) | null>(null)
  const holdTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)

  const shift = (next: Gear): void => {
    if (next === useStore.getState().vehicle.gear) return
    useStore.getState().setGear(next)
    playShiftChime()
  }

  useEffect(
    () => () => {
      detach.current?.()
      if (holdTimer.current) clearTimeout(holdTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    []
  )

  const visible = pinned || hover || dragDy !== null || holdN || gear !== 'P'

  const onEnter = (): void => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setHover(true)
  }
  const onLeave = (): void => {
    hideTimer.current = window.setTimeout(() => setHover(false), 1200)
  }

  /** Ends the swipe; `commit` shifts if it went far enough. */
  const endDrag = (commit: boolean): void => {
    const d = drag.current
    if (!d) return
    drag.current = null
    detach.current?.()
    detach.current = null
    setDragDy(null)
    const next = commit ? targetGear(d.dy) : null
    if (next) shift(next)
  }

  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || drag.current) return
    // No text selection or native drag: either would swallow the release.
    e.preventDefault()
    const el = e.currentTarget
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // The window-level listeners below still see the gesture.
    }
    const scale = el.getBoundingClientRect().height / el.offsetHeight || 1
    drag.current = { pointerId: e.pointerId, startY: e.clientY, scale, dy: 0 }
    setDragDy(0)

    // Track the gesture on the window, not the strip, so a release anywhere ends it.
    const onMove = (ev: PointerEvent): void => {
      const d = drag.current
      if (!d || ev.pointerId !== d.pointerId) return
      if ((ev.buttons & 1) === 0) {
        // The button is already up: the release happened somewhere we never heard about.
        endDrag(true)
        return
      }
      d.dy = (ev.clientY - d.startY) / d.scale
      setDragDy(d.dy)
    }
    const onUp = (ev: PointerEvent): void => {
      if (drag.current && ev.pointerId === drag.current.pointerId) endDrag(true)
    }
    const onCancel = (): void => endDrag(false)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    detach.current = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
    }
  }

  const startHoldN = (e: React.PointerEvent): void => {
    e.preventDefault()
    setHoldN(true)
    holdTimer.current = window.setTimeout(() => {
      shift('N')
      setHoldN(false)
    }, HOLD_MS)
  }
  const cancelHoldN = (): void => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    setHoldN(false)
  }

  const rest = REST[gear] ?? 0
  const dragging = dragDy !== null
  const offset = dragging ? Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, rest + dragDy)) : rest
  // While swiping, show the gear that letting go will select.
  const pending = dragging ? targetGear(dragDy) : null
  const willShift = pending !== null && pending !== gear
  const tag = willShift ? pending : gear === 'D' || gear === 'R' ? gear : null

  return (
    <div
      className={`${styles.hotzone} ${visible ? styles.visible : ''}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      data-testid="drive-strip"
      data-gear={gear}
    >
      <div className={styles.strip}>
        <button
          className={`${styles.box} ${gear === 'P' ? styles.boxActive : ''}`}
          onClick={() => shift('P')}
          data-testid="strip-park"
        >
          <b>P</b>
          <small>{gear === 'P' ? 'Parked' : 'Tap'}</small>
        </button>

        <div
          className={`${styles.track} ${dragging ? styles.dragging : ''}`}
          onPointerDown={onTrackDown}
          onLostPointerCapture={(e) => {
            // Capture can be dropped without a pointerup reaching us; finish the swipe then.
            if (drag.current && e.pointerId === drag.current.pointerId && (e.buttons & 1) === 0) endDrag(true)
          }}
          data-testid="strip-track"
        >
          <div className={styles.dots} />
          <ArrowUp
            className={`${styles.arrowUp} ${willShift && pending === 'D' ? styles.arrowLit : ''}`}
            size={40}
            strokeWidth={2.2}
          />
          <div
            className={`${styles.carIcon} ${willShift ? styles.carIconPending : ''}`}
            style={{ transform: `translate(-50%, calc(-50% + ${offset}px))` }}
            data-testid="strip-knob"
            data-pending={willShift ? pending : undefined}
          >
            <CarTop size={30} />
            {tag && <span className={styles.gearTag}>{tag}</span>}
          </div>
          <ArrowDown
            className={`${styles.arrowDown} ${willShift && pending === 'R' ? styles.arrowLit : ''}`}
            size={40}
            strokeWidth={2.2}
          />
        </div>

        <button
          className={`${styles.box} ${gear === 'N' ? styles.boxActive : ''} ${holdN ? styles.holding : ''}`}
          onPointerDown={startHoldN}
          onPointerUp={cancelHoldN}
          onPointerLeave={cancelHoldN}
          data-testid="strip-neutral"
        >
          <b>N</b>
          <small>{gear === 'N' ? 'Neutral' : 'Hold'}</small>
        </button>
      </div>
    </div>
  )
}
