import { lazy, Suspense } from 'react'
import { LAYOUT, PANEL } from '@shared/layout'
import { useStore } from '../state/store'
import { CarPane } from '../car-pane/CarPane'
import { DriveModeStrip } from '../car-pane/DriveModeStrip'
import { BrowserApp } from '../browser/BrowserApp'
import { StatusBar } from './StatusBar'
import { Dock } from './Dock'
import { AppLauncher } from './AppLauncher'
import { SafeBoundary } from './SafeBoundary'
import styles from './TeslaScreen.module.css'

// Heavy WebGL pieces load after the screen (and the browser) are up.
const MapApp = lazy(() => import('../map/MapApp').then((m) => ({ default: m.MapApp })))

/** The 1920x1200 Model 3 Highland center display. */
export function TeslaScreen() {
  const layout = useStore((s) => s.browserLayout)
  const rightApp = useStore((s) => s.rightApp)
  const launcherOpen = useStore((s) => s.launcherOpen)
  const expanded = rightApp === 'browser' && layout === 'expanded'
  const fullscreen = rightApp === 'browser' && layout === 'fullscreen'
  const rightLeft = expanded || fullscreen ? 0 : LAYOUT.carPaneWidth
  const contentHeight = PANEL.height - LAYOUT.dockHeight

  return (
    <div className={styles.screen} style={{ width: PANEL.width, height: PANEL.height }}>
      <div className={styles.carPane} style={{ width: LAYOUT.carPaneWidth, height: contentHeight }}>
        <SafeBoundary name="car-pane">
          <CarPane />
        </SafeBoundary>
      </div>

      <div className={styles.rightPane} style={{ left: rightLeft, width: PANEL.width - rightLeft, height: contentHeight }}>
        <SafeBoundary name="map">
          <Suspense fallback={null}>
            <MapApp />
          </Suspense>
        </SafeBoundary>
        <StatusBar showVehicleSummary={expanded} />
      </div>

      {/* The browser stays mounted so pages (and their audio) keep running when it's hidden. */}
      <BrowserApp
        visible={rightApp === 'browser'}
        left={rightLeft}
        top={fullscreen ? 0 : LAYOUT.statusBarHeight}
        width={PANEL.width - rightLeft}
        height={fullscreen ? PANEL.height : contentHeight - LAYOUT.statusBarHeight}
        fullscreen={fullscreen}
      />

      <div className={styles.dock} style={{ height: LAYOUT.dockHeight }}>
        <Dock />
      </div>

      {launcherOpen && <AppLauncher />}
      {!fullscreen && <DriveModeStrip />}
    </div>
  )
}
