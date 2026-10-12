import { useState } from 'react'
import { useStore } from '../state/store'
import { CarSide, ChevronLeft, ChevronRight, Volume, VolumeMuted } from '../icons'
import { BrowserApp, CameraApp, LauncherApp, NavApp, PhoneApp, TheaterApp, ToyboxApp } from '../icons/apps'
import styles from './Dock.module.css'

export function Dock() {
  const [temp, setTemp] = useState(72)
  const rightApp = useStore((s) => s.rightApp)
  const launcherOpen = useStore((s) => s.launcherOpen)
  const muted = useStore((s) => s.settings.muted)
  const { toggleApp, setLauncherOpen, patchSettings, openApp } = useStore.getState()

  const apps: { id: string; label: string; icon: React.ReactNode; onClick: () => void; active?: boolean }[] = [
    { id: 'nav', label: 'Navigate', icon: <NavApp size={60} />, onClick: () => openApp('map'), active: false },
    { id: 'camera', label: 'Camera', icon: <CameraApp size={60} />, onClick: () => undefined },
    { id: 'phone', label: 'Phone', icon: <PhoneApp size={60} />, onClick: () => undefined },
    {
      id: 'launcher',
      label: 'All apps',
      icon: <LauncherApp size={60} />,
      onClick: () => setLauncherOpen(!launcherOpen),
      active: launcherOpen
    },
    {
      id: 'browser',
      label: 'Browser',
      icon: <BrowserApp size={60} />,
      onClick: () => toggleApp('browser'),
      active: rightApp === 'browser'
    },
    { id: 'toybox', label: 'Toybox', icon: <ToyboxApp size={60} />, onClick: () => undefined },
    { id: 'theater', label: 'Theater', icon: <TheaterApp size={60} />, onClick: () => undefined }
  ]

  return (
    <div className={styles.dock}>
      <button className={styles.car} aria-label="Controls">
        <CarSide size={52} strokeWidth={1.4} />
      </button>

      <div className={styles.climate}>
        <button onClick={() => setTemp((t) => Math.max(59, t - 1))} aria-label="Cooler">
          <ChevronLeft size={30} />
        </button>
        <span className={styles.temp}>{temp}</span>
        <button onClick={() => setTemp((t) => Math.min(85, t + 1))} aria-label="Warmer">
          <ChevronRight size={30} />
        </button>
      </div>

      <div className={styles.apps}>
        {apps.map((a) => (
          <button
            key={a.id}
            className={styles.app}
            onClick={a.onClick}
            aria-label={a.label}
            data-testid={`dock-${a.id}`}
          >
            {a.icon}
            {a.active && <span className={styles.activeDot} />}
          </button>
        ))}
      </div>

      <div className={styles.volume}>
        <button aria-label="Volume down">
          <ChevronLeft size={30} />
        </button>
        <button onClick={() => patchSettings({ muted: !muted })} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeMuted size={42} /> : <Volume size={42} />}
        </button>
        <button aria-label="Volume up">
          <ChevronRight size={30} />
        </button>
      </div>
    </div>
  )
}
