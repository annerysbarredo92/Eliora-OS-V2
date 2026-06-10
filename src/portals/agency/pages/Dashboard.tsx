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

  return (
    <div className="animate-fade-up">
      {/* Welcome */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 300,
            color: 'var(--ink)',
            marginBottom: 'var(--space-1)',
            letterSpacing: '-0.01em',
          }}
        >
          Good morning, {firstName}.
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Onboarding progress banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 100%)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-5) var(--space-6)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 'var(--space-1)' }}>
            Setup Progress
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.85)' }}>
            Complete your workspace setup to unlock everything.
          </p>
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1, maxWidth: '200px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
              <div style={{ width: '20%', height: '100%', background: 'var(--accent-lt)', borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)' }}>1 of 5 steps complete</span>
          </div>
        </div>
        <Link to="/agency/operations">
          <Button
            variant="secondary"
            size="sm"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Continue setup →
          </Button>
        </Link>
      </div>

      {/* Quick links */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {QUICK_LINKS.map(link => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none' }}>
            <Card
              hover
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>{link.label}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Phase placeholder */}
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          <Badge variant="brand" style={{ marginBottom: 'var(--space-3)' }}>Phase 01 Foundation</Badge>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
            Dashboard metrics, activity feeds, and widgets will be built in Phase 02.
            The navigation, auth, and portal separation are live and ready.
          </p>
        </div>
      </Card>
    </div>
  )
}
