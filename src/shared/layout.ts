/**
 * Model 3 Highland center display geometry, in physical panel pixels (1920x1200).
 * Measured from reference photos and cross-checked against the 773x601 CSS-pixel
 * browser window reported by the car at DPR 1.53 (773*1.53 ~= 1183, 601*1.53 ~= 920).
 */
export const PANEL = { width: 1920, height: 1200 } as const

export const LAYOUT = {
  /** Left vehicle pane width (split view). */
  carPaneWidth: 737,
  /** Status bar across the top of the right pane. */
  statusBarHeight: 68,
  /** Browser toolbar (back/forward/URL bar). */
  browserToolbarHeight: 97,
  /** Bottom dock. */
  dockHeight: 115,
  /** Drive mode strip on the left edge. */
  driveStripWidth: 64
} as const

/** The browser's web content box in panel pixels. */
export const BROWSER_BOX = {
  split: {
    width: PANEL.width - LAYOUT.carPaneWidth,
    height: PANEL.height - LAYOUT.statusBarHeight - LAYOUT.browserToolbarHeight - LAYOUT.dockHeight
  },
  expanded: {
    width: PANEL.width,
    height: PANEL.height - LAYOUT.statusBarHeight - LAYOUT.browserToolbarHeight - LAYOUT.dockHeight
  },
  fullscreen: { width: PANEL.width, height: PANEL.height }
} as const
