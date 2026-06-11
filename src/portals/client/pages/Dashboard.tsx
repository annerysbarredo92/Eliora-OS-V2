import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClientPortal } from '@/features/portal/hooks'
import { useActivity } from '@/features/activity/hooks'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { Badge } from '@/components/ui/Badge'

export function ClientDashboard() {
  const { profile: user } = useAuth()
  const portal = useClientPortal(user)
  const activity = useActivity({ clientId: user?.client_id ?? undefined, limit: 8 })

  const companyName = portal.profile?.company_name || 'your workspace'
  const agencyName = portal.agency?.name || 'your agency'
  const firstName = (portal.profile?.contact_name || user?.display_name || '').split(' ')[0] || 'there'
  const completion = portal.onboarding?.completion_pct ?? 0
  const onboardingDone = completion >= 100

  return (
    <div className="animate-fade-up">
      {/* Welcome */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 'clamp(21px,2.6vw,30px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>
          Welcome back, {firstName}.
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          {companyName} · managed by {agencyName}
        </p>
      </div>

      {/* Top row: portal status + onboarding */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 22 }}>
        {/* Portal status */}
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Portal Status</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge variant="success">Active</Badge>
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>You're all set to collaborate.</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
            Your portal connects you with {agencyName}. More tools arrive here soon.
          </p>
        </div>

        {/* Onboarding progress */}
        <div style={{ background: '#0B0913', borderRadius: 'var(--radius)', padding: 20, position: 'relative', overflow: 'hidden', border: '1px solid rgba(109,61,230,0.3)' }}>
          <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .4, filter: 'blur(60px)', top: -80, right: -30, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Onboarding</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>{completion}%</span>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{onboardingDone ? 'complete' : 'complete'}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#F2CE5B)', borderRadius: 999, transition: 'width 400ms ease' }} />
            </div>
            <Link to="/portal/onboarding" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(109,61,230,0.3)', color: '#F3F1FA', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                {onboardingDone ? 'Review onboarding →' : 'Complete onboarding →'}
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 11 }}>Quick Actions</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <QuickAction to="/portal/onboarding" label="Complete onboarding" desc="Finish your setup" />
        <QuickAction to="/portal/settings" label="Update settings" desc="Contact & preferences" />
        <QuickAction label="View content" desc="Coming soon" soon />
        <QuickAction label="View files" desc="Coming soon" soon />
        <QuickAction label="View reports" desc="Coming soon" soon />
      </div>

      {/* Recent activity */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20 }}>
        <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Recent Activity</h3>
        <ActivityFeed items={activity.items} loading={activity.loading} emptyLabel="No activity yet — complete a section of your onboarding to get started." />
      </div>
    </div>
  )
}

function QuickAction({ to, label, desc, soon }: { to?: string; label: string; desc: string; soon?: boolean }) {
  const inner = (
    <div style={{
      background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)', padding: 16, height: '100%', position: 'relative',
      opacity: soon ? 0.6 : 1, cursor: soon ? 'not-allowed' : 'pointer', transition: 'transform 160ms ease',
    }}
      onMouseEnter={e => { if (!soon) e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
    >
      {soon && <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Soon</span>}
      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</p>
    </div>
  )
  if (soon || !to) return inner
  return <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link>
}
