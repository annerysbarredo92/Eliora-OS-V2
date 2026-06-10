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
        background: 'rgba(244,242,251,0.85)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid var(--hairline-2)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-8)',
        justifyContent: 'space-between',
        zIndex: 40,
      }}
    >
      <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '0.01em' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>
    </header>
  )
}
