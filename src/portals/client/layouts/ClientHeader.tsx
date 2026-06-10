import { InfinityMark } from '@/components/brand/InfinityMark'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'

export function ClientHeader() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header
      style={{
        background: '#0B0913',
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-10)',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .3, filter: 'blur(70px)', top: -150, left: -80, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <InfinityMark size={18} />
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#F3F1FA' }}>Eliora</span>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.45)' }}>
          {profile?.display_name || profile?.email}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 999,
            color: 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '5px 14px',
            fontFamily: 'var(--font-sans)',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = '#F3F1FA' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
