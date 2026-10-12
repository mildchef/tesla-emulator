import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrowserLayout } from '@shared/types'
import { LAYOUT } from '@shared/layout'
import { useStore } from '../state/store'
import { Toolbar } from './Toolbar'
import { NewTabPage } from './NewTabPage'
import { PermissionPrompt } from './PermissionPrompt'
import { isBlank } from './url'
import styles from './BrowserApp.module.css'

interface Props {
  visible: boolean
  left: number
  top: number
  width: number
  height: number
  fullscreen: boolean
}

export interface NavState {
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

/** The car's web browser: toolbar + a real Chromium <webview>. */
export function BrowserApp({ visible, left, top, width, height, fullscreen }: Props) {
  const ref = useRef<Electron.WebviewTag>(null)
  const [ready, setReady] = useState(false)
  const [nav, setNav] = useState<NavState>({ url: '', title: '', loading: false, canGoBack: false, canGoForward: false })
  const partition = useStore((s) => s.guestPartition)
  const pending = useStore((s) => s.pendingNavigation)
  const layoutBeforeFullscreen = useRef<BrowserLayout>('split')

  const refreshNav = useCallback(() => {
    const wv = ref.current
    if (!wv) return
    try {
      setNav((n) => ({
        ...n,
        url: wv.getURL(),
        title: wv.getTitle(),
        canGoBack: wv.canGoBack(),
        canGoForward: wv.canGoForward()
      }))
    } catch {
      // not attached yet
    }
  }, [])

  useEffect(() => {
    const wv = ref.current
    if (!wv) return
    const onReady = (): void => {
      setReady(true)
      refreshNav()
    }
    const onStart = (): void => setNav((n) => ({ ...n, loading: true }))
    const onStop = (): void => {
      setNav((n) => ({ ...n, loading: false }))
      refreshNav()
    }
    const onTitle = (e: Electron.PageTitleUpdatedEvent): void => setNav((n) => ({ ...n, title: e.title }))
    const onEnterFs = (): void => {
      const current = useStore.getState().browserLayout
      if (current !== 'fullscreen') layoutBeforeFullscreen.current = current
      void useStore.getState().setBrowserLayout('fullscreen')
    }
    const onLeaveFs = (): void => {
      void useStore.getState().setBrowserLayout(layoutBeforeFullscreen.current)
    }
    wv.addEventListener('dom-ready', onReady)
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('did-navigate', refreshNav)
    wv.addEventListener('did-navigate-in-page', refreshNav)
    wv.addEventListener('page-title-updated', onTitle)
    wv.addEventListener('enter-html-full-screen', onEnterFs)
    wv.addEventListener('leave-html-full-screen', onLeaveFs)
    return () => {
      wv.removeEventListener('dom-ready', onReady)
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('did-navigate', refreshNav)
      wv.removeEventListener('did-navigate-in-page', refreshNav)
      wv.removeEventListener('page-title-updated', onTitle)
      wv.removeEventListener('enter-html-full-screen', onEnterFs)
      wv.removeEventListener('leave-html-full-screen', onLeaveFs)
    }
  }, [refreshNav])

  const load = useCallback(
    (url: string) => {
      const wv = ref.current
      if (!wv || !url) return
      setNav((n) => ({ ...n, url }))
      if (ready) void wv.loadURL(url).catch(() => undefined)
      else wv.src = url
    },
    [ready]
  )

  useEffect(() => {
    if (pending) load(pending.url)
  }, [pending, load])

  const blank = isBlank(nav.url)

  return (
    <div
      className={`${styles.browser} ${visible ? '' : styles.hidden}`}
      style={{ left, top, width, height }}
      data-testid="browser"
    >
      {!fullscreen && <Toolbar webview={ref} nav={nav} onNavigate={load} />}
      <div className={styles.content} style={{ top: fullscreen ? 0 : LAYOUT.browserToolbarHeight }}>
        <webview
          ref={ref as unknown as React.Ref<HTMLWebViewElement>}
          className={styles.webview}
          src="about:blank"
          partition={partition}
          data-testid="webview"
        />
        {blank && !nav.loading && <NewTabPage onOpen={load} />}
        <PermissionPrompt />
      </div>
    </div>
  )
}
