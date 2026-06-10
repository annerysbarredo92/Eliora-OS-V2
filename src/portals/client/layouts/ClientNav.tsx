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
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        padding: '0 var(--space-10)',
        overflowX: 'auto',
      }}
    >
      {TABS.map(tab => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            padding: 'var(--space-4) var(--space-5)',
            fontSize: 'var(--text-sm)',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--brand-500)' : 'var(--ink-4)',
            textDecoration: 'none',
            borderBottom: isActive ? '2px solid var(--brand-500)' : '2px solid transparent',
            transition: 'all var(--duration-fast) var(--ease)',
            whiteSpace: 'nowrap',
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
