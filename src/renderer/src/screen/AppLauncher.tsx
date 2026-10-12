import { useStore } from '../state/store'
import {
  BrowserApp,
  CalendarApp,
  CameraApp,
  DashcamApp,
  MusicApp,
  NavApp,
  PhoneApp,
  TheaterApp,
  ToyboxApp
} from '../icons/apps'
import styles from './AppLauncher.module.css'

export function AppLauncher() {
  const { openApp, setLauncherOpen } = useStore.getState()
  const apps = [
    { label: 'Browser', icon: <BrowserApp size={72} />, run: () => openApp('browser') },
    { label: 'Theater', icon: <TheaterApp size={72} /> },
    { label: 'Toybox', icon: <ToyboxApp size={72} /> },
    { label: 'Camera', icon: <CameraApp size={72} /> },
    { label: 'Dashcam', icon: <DashcamApp size={72} /> },
    { label: 'Calendar', icon: <CalendarApp size={72} /> },
    { label: 'Music', icon: <MusicApp size={72} /> },
    { label: 'Phone', icon: <PhoneApp size={72} /> },
    { label: 'Navigate', icon: <NavApp size={72} />, run: () => openApp('map') }
  ]
  return (
    <>
      <div className={styles.scrim} onClick={() => setLauncherOpen(false)} />
      <div className={styles.panel} data-testid="app-launcher">
        {apps.map((a) => (
          <button key={a.label} className={styles.tile} onClick={a.run ?? (() => setLauncherOpen(false))}>
            {a.icon}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
