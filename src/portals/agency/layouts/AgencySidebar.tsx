import { NavLink, useNavigate } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

const NAV = [
  { path: '/agency/dashboard',     label: 'Dashboard',     icon: '⊞' },
  { path: '/agency/clients',       label: 'Clients',       icon: '◎' },
  { path: '/agency/content',       label: 'Content',       icon: '✦' },
  { path: '/agency/calendar',      label: 'Calendar',      icon: '◻' },
  { path: '/agency/tasks',         label: 'Tasks',         icon: '◈' },
  { path: '/agency/files',         label: 'Files',         icon: '◧' },
  { path: '/agency/reports',       label: 'Reports',       icon: '◉' },
  { path: '/agency/billing',       label: 'Billing',       icon: '◆' },
  { path: '/agency/pipeline',      label: 'Pipeline',      icon: '◇' },
  { path: '/agency/operations',    label: 'Operations',    icon: '⬡' },
  { path: '/agency/team',          label: 'Team',          icon: '◎' },
  { path: '/agency/notifications', label: 'Notifications', icon: '◉' },
  { path: '/agency/settings',      label: 'Settings',      icon: '◈' },
]

export function AgencySidebar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'var(--brand-700)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-5)',
          gap: 'var(--space-3)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}
      >
        <InfinityMark size={18} variant="light" animated={false} />
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-base)',
            fontWeight: 400,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Eliora
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: 'var(--space-4) var(--space-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 400,
              color: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              transition: 'all var(--duration-fast) var(--ease)',
            })}
          >
            <span style={{ fontSize: '13px', opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User / sign out */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              background: 'var(--brand-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 600,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {profile?.avatar_initials || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.8)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile?.display_name || 'User'}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.35)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color var(--duration-fast) var(--ease)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
