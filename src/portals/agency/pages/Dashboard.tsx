import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import { useActivity } from '@/features/activity/hooks'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { KpiCard } from '@/components/ui/KpiCard'
import { Card } from '@/components/ui/Card'

export function AgencyDashboard() {
  const { profile } = useAuth()
  const { metrics, loading } = useClients()
  const activity = useActivity({ limit: 8 })
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
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 'clamp(21px,2.6vw,30px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>
          {greeting}, {firstName}.
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Onboarding banner */}
      <div
        style={{
          background: '#0B0913', border: '1px solid rgba(109,61,230,0.3)', borderRadius: 'var(--radius)',
          padding: '20px 24px', marginBottom: 22, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 20, position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .35, filter: 'blur(60px)', top: -80, left: -40, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Setup Progress</p>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: 14 }}>Complete your workspace setup to unlock everything.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 180, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
              <div style={{ width: '20%', height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>1 of 5 steps complete</span>
          </div>
        </div>
        <Link to="/agency/operations" style={{ textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <button
            style={{ padding: '9px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(109,61,230,0.3)', color: '#F3F1FA', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'all 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,61,230,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,61,230,0.3)' }}
          >
            Continue setup →
          </button>
        </Link>
      </div>

      {/* Real client metrics */}
      <p style={kicker}>Clients</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KpiCard label="Active Clients"     value={loading ? '—' : metrics.active}     accent="success" />
        <KpiCard label="Onboarding"         value={loading ? '—' : metrics.onboarding} accent="gold" />
        <KpiCard label="Archived"           value={loading ? '—' : metrics.archived}   accent="muted" />
        <KpiCard label="Total Clients"      value={loading ? '—' : metrics.total}      accent="violet" hint={<Link to="/agency/clients" style={{ color: 'var(--violet)', textDecoration: 'none', fontWeight: 600 }}>Open Client Center →</Link>} />
      </div>

      {/* Placeholder metrics (later phases) */}
      <p style={kicker}>Operations <span style={{ color: 'var(--muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· coming in later phases</span></p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Pending Approvals"   value="—" accent="muted" placeholder />
        <KpiCard label="Upcoming Content"    value="—" accent="muted" placeholder />
        <KpiCard label="Outstanding Revenue" value="—" accent="muted" placeholder />
        <KpiCard label="Open Tasks"          value="—" accent="muted" placeholder />
      </div>

      {/* Recent activity */}
      <Card glass>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Activity</h3>
          <Link to="/agency/clients" style={{ fontSize: 12, color: 'var(--violet)', textDecoration: 'none', fontWeight: 600 }}>View clients →</Link>
        </div>
        <ActivityFeed items={activity.items} loading={activity.loading} emptyLabel="No activity yet — add your first client to get started." />
      </Card>
    </div>
  )
}

const kicker: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ink-2)', marginBottom: 11,
}
