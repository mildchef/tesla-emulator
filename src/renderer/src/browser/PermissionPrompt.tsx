import { useStore } from '../state/store'
import styles from './PermissionPrompt.module.css'

/** Tesla-style on-screen prompt for camera / microphone requests. */
export function PermissionPrompt() {
  const req = useStore((s) => s.permission)
  if (!req) return null
  const answer = (granted: boolean): void => {
    void window.emulator.answerPermission(req.id, granted)
    useStore.setState({ permission: null })
  }
  let host = req.origin
  try {
    host = new URL(req.origin).host
  } catch {
    // keep origin
  }
  const what = req.kinds.join(' and ')
  return (
    <div className={styles.scrim} data-testid="permission-prompt">
      <div className={styles.card}>
        <h3>
          <b>{host}</b> wants to use your {what}
        </h3>
        <p>{req.kinds.includes('camera') ? 'The cabin camera is only available while parked.' : 'Uses the cabin microphone.'}</p>
        <div className={styles.actions}>
          <button onClick={() => answer(false)} data-testid="permission-block">
            Block
          </button>
          <button className={styles.primary} onClick={() => answer(true)} data-testid="permission-allow">
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
