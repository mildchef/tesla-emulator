/** Colored dock/app-launcher icons, drawn to resemble the Tesla app tiles. */
type P = { size?: number }

export const NavApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <defs>
      <linearGradient id="nav-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4d7cff" />
        <stop offset="1" stopColor="#2346c4" />
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="36" height="36" rx="9" fill="url(#nav-g)" />
    <path d="M24 12 33 35l-9-5-9 5z" fill="#fff" />
    <path d="M24 12v18l-9 5z" fill="#ff5a5a" opacity=".85" />
  </svg>
)

export const CameraApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <circle cx="24" cy="24" r="17" fill="#26262b" />
    <circle cx="24" cy="24" r="12.5" fill="#101014" stroke="#5b5ad6" strokeWidth="2.2" />
    <circle cx="24" cy="24" r="6.5" fill="#1d2b6b" />
    <circle cx="21.5" cy="21.5" r="2.2" fill="#cfd8ff" opacity=".85" />
  </svg>
)

export const PhoneApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path
      d="M17.6 10.5c.9-.4 2-.1 2.6.7l3.2 4.6c.6.9.5 2.1-.3 2.8l-2.2 2c1.3 3 3.6 5.4 6.6 6.7l2-2.2c.7-.8 1.9-.9 2.8-.3l4.6 3.2c.8.6 1.1 1.7.7 2.6l-1.3 2.9c-.6 1.3-2 2.1-3.4 1.8C21.6 33.8 14.2 26.4 12.7 15c-.2-1.4.5-2.8 1.8-3.4z"
      fill="#3ccf5a"
    />
  </svg>
)

export const LauncherApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="9" y="9" width="30" height="30" rx="7" fill="none" stroke="#9a9aa2" strokeWidth="2" />
    <circle cx="17" cy="24" r="2.3" fill="#e8e8ea" />
    <circle cx="24" cy="24" r="2.3" fill="#e8e8ea" />
    <circle cx="31" cy="24" r="2.3" fill="#e8e8ea" />
  </svg>
)

export const ToyboxApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="12" y="32" width="24" height="7" rx="3" fill="#3a3a40" />
    <rect x="22.6" y="18" width="2.8" height="15" fill="#cfcfd4" />
    <circle cx="24" cy="15" r="6" fill="#e8333b" />
    <circle cx="22" cy="13" r="1.8" fill="#ff8a8f" />
  </svg>
)

export const TheaterApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="10" y="17" width="28" height="20" rx="3" fill="#f2f2f4" />
    <path d="M10 13.5 36.5 8l.9 4.3L11 17.8z" fill="#f2f2f4" />
    <path d="m15 12.5 4 3.6M22 11l4 3.6M29 9.5l4 3.6" stroke="#202024" strokeWidth="2.2" />
    <path d="m21 22.5 8 4.5-8 4.5z" fill="#202024" />
  </svg>
)

export const BrowserApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <defs>
      <linearGradient id="br-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f7f7f8" />
        <stop offset="1" stopColor="#d4d6db" />
      </linearGradient>
    </defs>
    <rect x="7" y="7" width="34" height="34" rx="9" fill="url(#br-g)" />
    <circle cx="24" cy="24" r="10.5" fill="none" stroke="#2b5fd9" strokeWidth="2.2" />
    <path d="M13.5 24h21M24 13.5c3 2.8 4.4 6.3 4.4 10.5S27 31.7 24 34.5c-3-2.8-4.4-6.3-4.4-10.5S21 16.3 24 13.5z" fill="none" stroke="#2b5fd9" strokeWidth="2" />
  </svg>
)

export const MusicApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="7" y="7" width="34" height="34" rx="9" fill="#fa3c55" />
    <path d="M20 31.5V16.5l12-2.5v14" fill="none" stroke="#fff" strokeWidth="2.4" />
    <circle cx="17.5" cy="31.5" r="3.2" fill="#fff" />
    <circle cx="29.5" cy="28" r="3.2" fill="#fff" />
  </svg>
)

export const CalendarApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="7" fill="#fff" />
    <path d="M8 15a7 7 0 0 1 7-7h18a7 7 0 0 1 7 7v2H8z" fill="#ea4335" />
    <text x="24" y="34" textAnchor="middle" fontSize="15" fontWeight="600" fill="#222" fontFamily="inherit">
      {new Date().getDate()}
    </text>
  </svg>
)

export const DashcamApp = ({ size = 48 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="7" y="7" width="34" height="34" rx="9" fill="#2a2a30" />
    <rect x="13" y="17" width="16" height="14" rx="3" fill="#d9d9de" />
    <path d="m30 21.5 6-3.5v12l-6-3.5z" fill="#d9d9de" />
    <circle cx="17.5" cy="21.5" r="2" fill="#e8333b" />
  </svg>
)
