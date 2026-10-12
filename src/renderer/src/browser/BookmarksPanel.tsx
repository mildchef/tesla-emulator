import { useState } from 'react'
import { useStore } from '../state/store'
import { Close } from '../icons'
import styles from './BookmarksPanel.module.css'

export function BookmarksPanel({ onClose, onOpen }: { onClose: () => void; onOpen: (url: string) => void }) {
  const bookmarks = useStore((s) => s.bookmarks)
  const history = useStore((s) => s.history)
  const [tab, setTab] = useState<'bookmarks' | 'history'>('bookmarks')
  const items = tab === 'bookmarks' ? bookmarks : history
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.tabs}>
          <button className={tab === 'bookmarks' ? styles.active : ''} onClick={() => setTab('bookmarks')}>
            Bookmarks
          </button>
          <button className={tab === 'history' ? styles.active : ''} onClick={() => setTab('history')}>
            History
          </button>
        </div>
        <div className={styles.list}>
          {items.length === 0 && <p className={styles.empty}>Nothing here yet</p>}
          {items.map((item) => (
            <div key={item.url} className={styles.row}>
              <button className={styles.link} onClick={() => onOpen(item.url)}>
                <b>{item.title || item.url}</b>
                <span>{item.url}</span>
              </button>
              {tab === 'bookmarks' && (
                <button className={styles.remove} onClick={() => void window.emulator.removeBookmark(item.url)} aria-label="Remove">
                  <Close size={22} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
