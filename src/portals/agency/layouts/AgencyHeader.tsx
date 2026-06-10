import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  dashboard:     'Dashboard',
  clients:       'Client Center',
  content:       'Content Studio',
  calendar:      'Calendar Hub',
  tasks:         'Tasks Hub',
  files:         'Files Hub',
  reports:       'Reports & Analytics',
  billing:       'Billing & Financials',
  pipeline:      'Proposals & Pipeline',
  operations:    'Operations Hub',
  team:          'Team Hub',
  notifications: 'Notifications',
  settings:      'Settings',
}

export function AgencyHeader() {
  const { pathname } = useLocation()
  const segment = pathname.split('/').filter(Boolean)[1] || 'dashboard'
  const title = PAGE_TITLES[segment] || 'Eliora OS'

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 'var(--sidebar-width)',
        height: 'var(--header-height)',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-8)',
        justifyContent: 'space-between',
        zIndex: 40,
      }}
    >
      <h1
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-5)',
            letterSpacing: '0.04em',
          }}
        >
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>
    </header>
  )
}
