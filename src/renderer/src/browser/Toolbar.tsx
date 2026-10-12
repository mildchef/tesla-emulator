import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { ArrowLeft, ArrowRight, Close, Collapse, Expand, ListPanel, Reload, Search, Star } from '../icons'
import type { NavState } from './BrowserApp'
import { BookmarksPanel } from './BookmarksPanel'
import { displayUrl, toUrl } from './url'
import styles from './Toolbar.module.css'

interface Props {
  webview: React.RefObject<Electron.WebviewTag | null>
  nav: NavState
  onNavigate: (url: string) => void
}

export function Toolbar({ webview, nav, onNavigate }: Props) {
  const parked = useStore((s) => s.vehicle.gear === 'P')
  const layout = useStore((s) => s.browserLayout)
  const bookmarks = useStore((s) => s.bookmarks)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setText(displayUrl(nav.url))
  }, [nav.url, editing])

  const bookmarked = bookmarks.some((b) => b.url === nav.url)
  const expanded = layout === 'expanded'

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const url = toUrl(text)
    if (!url) return
    setEditing(false)
    input.current?.blur()
    onNavigate(url)
  }

  const toggleBookmark = (): void => {
    if (!nav.url || nav.url === 'about:blank') return
    if (bookmarked) void window.emulator.removeBookmark(nav.url)
    else void window.emulator.addBookmark(nav.url, nav.title || nav.url)
  }

  return (
    <div className={styles.toolbar} data-testid="browser-toolbar">
      <button
        className={styles.icon}
        disabled={!parked}
        onClick={() => void useStore.getState().setBrowserLayout(expanded ? 'split' : 'expanded')}
        aria-label={expanded ? 'Exit full screen' : 'Full screen'}
        title={parked ? undefined : 'Full screen is only available in Park'}
        data-testid="browser-expand"
      >
        {expanded ? <Collapse size={34} /> : <Expand size={34} />}
      </button>
      <button
        className={styles.icon}
        disabled={!nav.canGoBack}
        onClick={() => webview.current?.goBack()}
        aria-label="Back"
        data-testid="browser-back"
      >
        <ArrowLeft size={34} />
      </button>
      <button
        className={styles.icon}
        disabled={!nav.canGoForward}
        onClick={() => webview.current?.goForward()}
        aria-label="Forward"
      >
        <ArrowRight size={34} />
      </button>

      <form className={styles.field} onSubmit={submit}>
        <Search size={26} className={styles.fieldIcon} />
        <input
          ref={input}
          value={text}
          placeholder="Search Google or type a URL"
          spellCheck={false}
          onFocus={(e) => {
            setEditing(true)
            e.currentTarget.select()
          }}
          onBlur={() => setEditing(false)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false)
              setText(displayUrl(nav.url))
              input.current?.blur()
            }
          }}
          data-testid="url-input"
        />
        <button
          type="button"
          className={styles.reload}
          onClick={() => (nav.loading ? webview.current?.stop() : webview.current?.reload())}
          aria-label={nav.loading ? 'Stop' : 'Reload'}
        >
          {nav.loading ? <Close size={26} /> : <Reload size={26} />}
        </button>
        {nav.loading && <span className={styles.loadingBar} />}
      </form>

      <button className={styles.icon} onClick={toggleBookmark} aria-label="Bookmark" data-testid="browser-star">
        <Star size={32} filled={bookmarked} />
      </button>
      <button className={styles.icon} onClick={() => setPanelOpen((o) => !o)} aria-label="Bookmarks and history">
        <ListPanel size={32} />
      </button>
      {panelOpen && (
        <BookmarksPanel
          onClose={() => setPanelOpen(false)}
          onOpen={(url) => {
            setPanelOpen(false)
            onNavigate(url)
          }}
        />
      )}
    </div>
  )
}
