import { useStore } from '../state/store'
import styles from './NewTabPage.module.css'

/** The car's new-tab heading, set in plain text rather than Tesla's logotype. */
function Wordmark() {
  return <div className={styles.wordmark}>TESLA</div>
}

function initialOf(title: string, url: string): string {
  const source = title || url.replace(/^https?:\/\/(www\.)?/, '')
  return source.charAt(0).toUpperCase()
}

/** Public hostname for favicon lookup; local/dev hosts are never sent anywhere. */
function publicHost(url: string): string {
  try {
    const host = new URL(url).hostname
    if (!host.includes('.') || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local')) return ''
    return host
  } catch {
    return ''
  }
}

export function NewTabPage({ onOpen }: { onOpen: (url: string) => void }) {
  const bookmarks = useStore((s) => s.bookmarks)
  const probeUrl = useStore((s) => s.probeUrl)
  const tiles = [...bookmarks, ...(probeUrl ? [{ url: probeUrl, title: 'Browser probe' }] : [])]
  return (
    <div className={styles.ntp} data-testid="new-tab-page">
      <Wordmark />
      <div className={styles.tiles}>
        {tiles.map((b) => {
          const host = publicHost(b.url)
          return (
          <button key={b.url} className={styles.tile} onClick={() => onOpen(b.url)} title={b.url}>
            <span className={styles.circle}>
              {host && (
                <img
                  src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <i>{initialOf(b.title, b.url)}</i>
            </span>
            <span className={styles.name}>{b.title}</span>
          </button>
          )
        })}
      </div>
    </div>
  )
}
