import { Outlet, Link } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'

export function AuthLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}
    >
      {/* Left — brand panel */}
      <div
        style={{
          background: 'var(--brand-700)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-12)',
          gap: 'var(--space-6)',
        }}
      >
        <InfinityMark size={48} variant="light" animated />
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 300,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.92)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Eliora
          </div>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.05em',
              maxWidth: '280px',
              lineHeight: 1.7,
            }}
          >
            The operating system for premium marketing agencies.
          </p>
        </div>

        <div
          style={{
            marginTop: 'auto',
            fontSize: 'var(--text-xs)',
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.08em',
          }}
        >
          © {new Date().getFullYear()} Eliora OS
        </div>
      </div>

      {/* Right — form area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-12)',
          background: 'var(--surface)',
        }}
      >
        <Link
          to="/"
          style={{
            position: 'absolute',
            top: 'var(--space-6)',
            right: 'var(--space-6)',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-4)',
            textDecoration: 'none',
          }}
        >
          ← Back to home
        </Link>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
