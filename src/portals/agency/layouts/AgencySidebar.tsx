import { NavLink, useNavigate } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

const NAV = [
  { path: '/agency/dashboard',     label: 'Dashboard'     },
  { path: '/agency/projects',      label: 'Projects'      },
  { path: '/agency/content',       label: 'Content'       },
  { path: '/agency/calendar',      label: 'Calendar'      },
  { path: '/agency/team',          label: 'Team'          },
  { path: '/agency/files',         label: 'Files'         },
  { path: '/agency/billing',       label: 'Billing'       },
  { path: '/agency/reports',       label: 'Reports'       },
  { path: '/agency/operations',    label: 'Operations'    },
  { path: '/agency/ai',            label: 'AI Studio'     },
  { path: '/agency/notifications', label: 'Notifications' },
  { path: '/agency/settings',      label: 'Settings'      },
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
        background: '#0B0913',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflowY: 'auto',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* atmosphere */}
      <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .35, filter: 'blur(70px)', top: -80, left: -60, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,#F2CE5B,transparent 70%)', opacity: .15, filter: 'blur(70px)', bottom: -60, right: -40, pointerEvents: 'none' }} />

      {/* Logo */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <InfinityMark size={18} />
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#F3F1FA' }}>Eliora OS.M</span>
      </div>

      {/* Navigation */}
      <nav style={{ position: 'relative', zIndex: 2, flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '9px 12px',
              borderRadius: 12,
              textDecoration: 'none',
              fontSize: '13.5px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#F3F1FA' : 'rgba(255,255,255,0.45)',
              background: isActive ? 'rgba(109,61,230,0.25)' : 'transparent',
              transition: 'all 120ms ease',
              letterSpacing: '-0.01em',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              if (!el.getAttribute('aria-current')) el.style.color = 'rgba(255,255,255,0.75)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              if (!el.getAttribute('aria-current')) el.style.color = 'rgba(255,255,255,0.45)'
            }}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User / sign out */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(105deg,#6D3DE6,#9258EE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {profile?.avatar_initials || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.display_name || 'User'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: '13px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color 120ms ease',
            fontFamily: 'var(--font-sans)',
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
