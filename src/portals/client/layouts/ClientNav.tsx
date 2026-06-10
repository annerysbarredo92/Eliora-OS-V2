import { NavLink } from 'react-router-dom'

const TABS = [
  { path: '/portal/dashboard',  label: 'Dashboard' },
  { path: '/portal/content',    label: 'Content Review' },
  { path: '/portal/approved',   label: 'Approved' },
  { path: '/portal/files',      label: 'Files' },
  { path: '/portal/reports',    label: 'Reports' },
  { path: '/portal/billing',    label: 'Billing' },
  { path: '/portal/messages',   label: 'Messages' },
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
      {TABS.map(tab => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            padding: '14px 16px',
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
      ))}
    </nav>
  )
}
