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
        background: 'var(--brand-700)',
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-10)',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <InfinityMark size={16} variant="light" animated={false} />
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-lg)',
            fontWeight: 300,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Eliora
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)' }}>
          {profile?.display_name || profile?.email}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            padding: 'var(--space-1) var(--space-2)',
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
