import { NavLink, useNavigate } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

const PRIMARY_NAV = [
  { path: '/agency/home',     label: 'Home'     },
  { path: '/agency/projects', label: 'Projects' },
  { path: '/agency/agency',   label: 'Agency'   },
  { path: '/agency/inbox',    label: 'Inbox'    },
  { path: '/agency/ai',       label: 'AI'       },
]

export function AgencySidebar() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 'var(--sidebar-width)',
        background: '#0B0913',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, overflowY: 'auto',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* atmosphere glows */}
      <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .35, filter: 'blur(70px)', top: -80, left: -60, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,#F2CE5B,transparent 70%)', opacity: .15, filter: 'blur(70px)', bottom: -60, right: -40, pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 2, height: 'var(--header-height)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <InfinityMark size={18} />
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#F3F1FA' }}>Eliora OS.M</span>
      </div>

      {/* Primary navigation */}
      <nav style={{ position: 'relative', zIndex: 2, flex: 1, padding: '18px 10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PRIMARY_NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              padding: '10px 14px', borderRadius: 12, textDecoration: 'none',
              fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
              color: isActive ? '#F3F1FA' : 'rgba(255,255,255,0.45)',
              background: isActive ? 'rgba(109,61,230,0.25)' : 'transparent',
              transition: 'all 120ms ease', letterSpacing: '-0.01em',
            })}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!el.getAttribute('aria-current')) el.style.color = 'rgba(255,255,255,0.75)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!el.getAttribute('aria-current')) el.style.color = 'rgba(255,255,255,0.45)' }}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: user + settings shortcut + sign out */}
      <div style={{ position: 'relative', zIndex: 2, padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(105deg,#6D3DE6,#9258EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {profile?.avatar_initials || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.display_name || 'User'}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {/* Settings + Sign out row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <NavLink
            to="/agency/agency/settings"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none', fontFamily: 'var(--font-sans)', transition: 'all 120ms ease' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.75)'; el.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.4)'; el.style.background = 'rgba(255,255,255,0.04)' }}
          >
            <GearIcon /> Settings
          </NavLink>
          <button
            onClick={handleSignOut}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 120ms ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}

function GearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
