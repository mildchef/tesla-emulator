import { Component, type ReactNode } from 'react'

/**
 * Keeps an optional subsystem (map, 3D car) from taking the whole screen down,
 * e.g. when WebGL isn't available.
 */
export class SafeBoundary extends Component<{ name: string; fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error(`[${this.props.name}] disabled:`, error)
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
