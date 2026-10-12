import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 6 8.5 12l6 6" />
  </Svg>
)
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
)
export const ArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M20 12H4.5M10.5 6l-6 6 6 6" />
  </Svg>
)
export const ArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15.5M13.5 6l6 6-6 6" />
  </Svg>
)
export const ArrowUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 20V4.5M6 10.5l6-6 6 6" />
  </Svg>
)
export const ArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v15.5M6 13.5l6 6 6-6" />
  </Svg>
)
export const Expand = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5" />
  </Svg>
)
export const Collapse = (p: P) => (
  <Svg {...p}>
    <path d="M20 10h-6V4M14 10l6.5-6.5M4 14h6v6M10 14l-6.5 6.5" />
  </Svg>
)
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Svg>
)
export const Reload = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </Svg>
)
export const Close = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const Star = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
)
export const ListPanel = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M9 4.5v15M12 9h5.5M12 12.5h5.5M12 16h3.5" />
  </Svg>
)
export const Lock = ({ open, ...p }: P & { open?: boolean }) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" stroke="none" />
    {open ? <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" /> : <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />}
  </Svg>
)
export const Bolt = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 2.5 5.5 13.5h6l-1 8 8-11h-6z" fill="currentColor" stroke="none" />
  </Svg>
)
export const CarSide = (p: P) => (
  <Svg {...p}>
    <path d="M3 15.5v-2.2c0-.9.5-1.6 1.3-1.9l2.4-.9 2.6-3.1c.4-.5 1-.8 1.7-.8h3.6c.7 0 1.4.3 1.8.9l2.3 3 1.9.7c.8.3 1.4 1.1 1.4 2v2.3" />
    <path d="M3 15.5h2.2M9.3 15.5h5.4M18.8 15.5H21" />
    <circle cx="7.2" cy="15.8" r="1.9" />
    <circle cx="16.8" cy="15.8" r="1.9" />
    <path d="M7 10.7h10" />
  </Svg>
)
/** Top-down car, as used on the drive mode strip. */
export const CarTop = (p: P) => (
  <svg width={p.size ?? 24} height={(p.size ?? 24) * 1.9} viewBox="0 0 24 46" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...p}>
    <path d="M6 7.5c0-3 2.6-5.5 6-5.5s6 2.5 6 5.5v31c0 3-2.6 5.5-6 5.5s-6-2.5-6-5.5z" />
    <path d="M7.4 14.5c3-1.4 6.2-1.4 9.2 0l-.9 6.5H8.3zM8.3 31.5h7.4l.9 4.5c-3 1.2-6.2 1.2-9.2 0z" />
    <path d="M6 13.5 4.4 12.4M18 13.5l1.6-1.1" />
  </svg>
)
export const Volume = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5l5 4v-13l-5 4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
)
export const VolumeMuted = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5l5 4v-13l-5 4z" fill="currentColor" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
)
export const Prev = (p: P) => (
  <Svg {...p}>
    <path d="M6 5v14" />
    <path d="M18.5 5.5v13L9 12z" fill="currentColor" />
  </Svg>
)
export const Next = (p: P) => (
  <Svg {...p}>
    <path d="M18 5v14" />
    <path d="M5.5 5.5v13L15 12z" fill="currentColor" />
  </Svg>
)
export const Pause = (p: P) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" strokeWidth={2.6} />
  </Svg>
)
export const Play = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15L19.5 12z" fill="currentColor" />
  </Svg>
)
export const Heart = (p: P) => (
  <Svg {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
)
export const Equalizer = (p: P) => (
  <Svg {...p}>
    <path d="M6 4v16M12 4v16M18 4v16" />
    <path d="M3.8 14h4.4M9.8 8.5h4.4M15.8 15.5h4.4" strokeWidth={2} />
  </Svg>
)
export const Shuffle = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 7h3.2c1.3 0 2.5.6 3.2 1.7l4.2 6.6c.7 1.1 1.9 1.7 3.2 1.7h3.2M3.5 17h3.2c1.3 0 2.5-.6 3.2-1.7l.5-.8M14.3 9.5l.4-.8C15.4 7.6 16.6 7 17.9 7h2.6" />
    <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" />
  </Svg>
)
export const Repeat = (p: P) => (
  <Svg {...p}>
    <path d="M4 11.5V10a3 3 0 0 1 3-3h13M20 12.5V14a3 3 0 0 1-3 3H4" />
    <path d="m17 4 3 3-3 3M7 20l-3-3 3-3" />
  </Svg>
)
export const Person = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" fill="currentColor" stroke="none" />
    <path d="M4.5 20.5c.6-4 3.6-6.3 7.5-6.3s6.9 2.3 7.5 6.3z" fill="currentColor" stroke="none" />
  </Svg>
)
export const CloudSun = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M9 2.5v1.2M3.6 8.5H2.4M4.8 4.3l.9.9M13.2 4.3l-.9.9" />
    <path d="M8 19.5h9.5a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.3 1.1A3 3 0 0 0 8 19.5z" fill="currentColor" stroke="none" opacity=".9" />
  </Svg>
)
export const Globe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5z" />
  </Svg>
)
export const Dots = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
)
export const SeatbeltPerson = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="4.5" r="2" fill="currentColor" stroke="none" />
    <path d="M9 8.5h4l1.5 6.5h4l1.5 5M9 8.5l-1 6.5 2.5 5" />
  </Svg>
)
export const RouteIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6.5" cy="18" r="2" />
    <circle cx="17.5" cy="6" r="2" />
    <path d="M8.5 18h6.5a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
  </Svg>
)
