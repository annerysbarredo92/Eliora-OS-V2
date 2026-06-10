import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'

const QUICK_LINKS = [
  { label: 'Client Center',   path: '/agency/clients',    desc: 'View all clients' },
  { label: 'Content Studio',  path: '/agency/content',    desc: 'Manage content' },
  { label: 'Operations Hub',  path: '/agency/operations', desc: 'SOPs & setup' },
  { label: 'Team Hub',        path: '/agency/team',       desc: 'Manage your team' },
]

export function AgencyDashboard() {
  const { profile } = useAuth()
  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="animate-fade-up">
      {/* Welcome */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 6 }}>
          {greeting}, {firstName}.
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Onboarding progress banner */}
      <div
        style={{
          background: '#0B0913',
          border: '1px solid rgba(109,61,230,0.3)',
          borderRadius: 'var(--radius)',
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .35, filter: 'blur(60px)', top: -80, left: -40, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            Setup Progress
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: 14 }}>
            Complete your workspace setup to unlock everything.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 180, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
              <div style={{ width: '20%', height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>1 of 5 steps complete</span>
          </div>
        </div>
        <Link to="/agency/operations" style={{ textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <button
            style={{
              padding: '9px 18px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(109,61,230,0.3)',
              color: '#F3F1FA',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,61,230,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,61,230,0.3)' }}
          >
            Continue setup →
          </button>
        </Link>
      </div>

      {/* Quick links */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {QUICK_LINKS.map(link => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none' }}>
            <Card
              glass
              hover
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{link.label}</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Phase placeholder */}
      <Card glass padding="lg">
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Badge variant="brand" style={{ marginBottom: 14 }}>Phase 01 Foundation</Badge>
          <p style={{ fontSize: '14px', color: 'var(--ink-2)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
            Dashboard metrics, activity feeds, and widgets will be built in Phase 02.
            Navigation, auth, and portal separation are live and ready.
          </p>
          <div style={{ marginTop: 20 }}>
            <Button variant="secondary" size="sm">
              <Link to="/agency/operations" style={{ textDecoration: 'none', color: 'inherit' }}>Go to Operations Hub</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
