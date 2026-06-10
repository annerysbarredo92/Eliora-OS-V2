import { Link, useLocation } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'
import { Button } from '@/components/ui/Button'

export function PublicNav() {
  const { pathname } = useLocation()

  const links = [
    { to: '/',        label: 'Home' },
    { to: '/pricing', label: 'Pricing' },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--header-height)',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-10)',
        justifyContent: 'space-between',
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          textDecoration: 'none',
        }}
      >
        <InfinityMark size={18} variant="gradient" animated={false} />
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-lg)',
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'var(--brand-700)',
          }}
        >
          Eliora
        </span>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            style={{
              fontSize: 'var(--text-sm)',
              color: pathname === l.to ? 'var(--brand-500)' : 'var(--ink-3)',
              textDecoration: 'none',
              fontWeight: pathname === l.to ? 500 : 400,
              transition: 'color var(--duration) var(--ease)',
            }}
          >
            {l.label}
          </Link>
        ))}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={() => {}}>
            <Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>Sign in</Link>
          </Button>
          <Button variant="primary" size="sm">
            <Link to="/signup" style={{ textDecoration: 'none', color: 'inherit' }}>Get started</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
