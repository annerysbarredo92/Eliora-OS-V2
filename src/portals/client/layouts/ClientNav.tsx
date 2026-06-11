import { NavLink } from 'react-router-dom'

const TABS = [
  { path: '/portal/dashboard',  label: 'Dashboard',  live: true },
  { path: '/portal/onboarding', label: 'Onboarding', live: true },
  { path: '/portal/content',    label: 'Content',    live: false },
  { path: '/portal/files',      label: 'Files',      live: false },
  { path: '/portal/reports',    label: 'Reports',    live: false },
  { path: '/portal/messages',   label: 'Messages',   live: false },
  { path: '/portal/settings',   label: 'Settings',   live: true },
]

export function ClientNav() {
  return (
    <nav
      style={{
        background: 'rgba(244,242,251,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--hairline-2)',
        display: 'flex',
        padding: '0 40px',
        overflowX: 'auto',
      }}
    >
      {TABS.map(tab =>
        tab.live ? (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              padding: '13px 16px',
              fontSize: '13.5px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--violet)' : 'var(--ink-2)',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid var(--violet)' : '2px solid transparent',
              transition: 'all 120ms ease',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            })}
          >
            {tab.label}
          </NavLink>
        ) : (
          <span
            key={tab.path}
            title="Coming in a later phase"
            style={{
              padding: '13px 16px',
              fontSize: '13.5px',
              color: 'var(--muted)',
              borderBottom: '2px solid transparent',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'not-allowed',
            }}
          >
            {tab.label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </span>
        )
      )}
    </nav>
  )
}
