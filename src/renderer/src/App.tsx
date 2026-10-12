import { useEffect, useRef, useState } from 'react'
import { PANEL } from '@shared/layout'
import { useStore } from './state/store'
import { TeslaScreen } from './screen/TeslaScreen'
import { DevDrawer } from './dev/DevDrawer'
import styles from './App.module.css'

const BEZEL = 26
const MARGIN = 28

/** Fits the bezel + 1920x1200 panel into the available window area. */
function useFit(ref: React.RefObject<HTMLDivElement | null>): { scale: number; left: number; top: number } {
  const [fit, setFit] = useState({ scale: 0.5, left: 0, top: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = (): void => {
      const w = el.clientWidth
      const h = el.clientHeight
      const fullW = PANEL.width + BEZEL * 2
      const fullH = PANEL.height + BEZEL * 2
      const scale = Math.max(0.1, Math.min((w - MARGIN * 2) / fullW, (h - MARGIN * 2) / fullH))
      setFit({ scale, left: (w - fullW * scale) / 2, top: (h - fullH * scale) / 2 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return fit
}

export function App() {
  const area = useRef<HTMLDivElement>(null)
  const { scale, left, top } = useFit(area)
  useEffect(() => useStore.setState({ stageScale: scale }), [scale])
  const drawerOpen = useStore((s) => s.drawerOpen)
  const theme = useStore((s) => s.settings.theme)

  return (
    <div className={styles.app}>
      <div ref={area} className={styles.area}>
        <div
          className={styles.bezel}
          style={{
            width: PANEL.width + BEZEL * 2,
            height: PANEL.height + BEZEL * 2,
            padding: BEZEL,
            transform: `translate(${left}px, ${top}px) scale(${scale})`
          }}
        >
          <div className={`${styles.screen} theme-${theme}`} data-testid="tesla-screen">
            <TeslaScreen />
          </div>
        </div>
        <button
          className={styles.drawerHandle}
          onClick={() => useStore.getState().toggleDrawer()}
          title="Developer drawer (⌘.)"
          data-testid="drawer-toggle"
        >
          {drawerOpen ? '›' : '‹'} DEV
        </button>
      </div>
      {drawerOpen && <DevDrawer />}
    </div>
  )
}
