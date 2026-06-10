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
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--header-height)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
        borderBottom: '1px solid var(--hairline-2)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        justifyContent: 'space-between',
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <InfinityMark size={20} />
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Eliora
        </span>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            style={{
              fontSize: '13.5px',
              fontWeight: 500,
              color: pathname === l.to ? 'var(--violet)' : 'var(--ink-2)',
              textDecoration: 'none',
              padding: '7px 13px',
              borderRadius: 999,
              background: pathname === l.to ? 'var(--lavender-soft)' : 'transparent',
              transition: 'all 200ms ease',
              letterSpacing: '0.01em',
            }}
          >
            {l.label}
          </Link>
        ))}

        <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/signup" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
