import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClientPortal } from '@/features/portal/hooks'
import { useClientOnboarding } from '@/features/onboarding/hooks'
import { readProgress, statusLabel } from '@/features/onboarding/helpers'
import { useActivity } from '@/features/activity/hooks'
import { useClientContent } from '@/features/content/hooks'
import { useClientFiles } from '@/features/files/hooks'
import { useClientReports } from '@/features/reports/hooks'
import { downloadFile } from '@/features/files/api'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export function ClientDashboard() {
  const { profile: user } = useAuth()
  const portal = useClientPortal(user)
  const ob = useClientOnboarding(user)
  const activity = useActivity({ clientId: user?.client_id ?? undefined, limit: 8 })
  const content = useClientContent()
  const files = useClientFiles(user?.client_id ?? null)
  const reports = useClientReports()

  const pendingReviews = content.items.filter(c => c.status === 'client_review').length
  const recentFiles = files.files.slice(0, 4)
  const recentReports = reports.reports.slice(0, 3)

  const companyName = portal.profile?.company_name || 'your workspace'
  const agencyName = portal.agency?.name || 'your agency'
  const firstName = (portal.profile?.contact_name || user?.display_name || '').split(' ')[0] || 'there'

  const { pct: completion, status, missing } = readProgress(ob.progress)
  const onboardingDone = status === 'submitted'

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

      {/* Persistent onboarding reminder */}
      {!onboardingDone && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: 'var(--lavender-soft)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--violet)', flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              Your onboarding is <strong style={{ color: 'var(--ink)' }}>{completion}% complete</strong>
              {missing.length > 0 ? ` · ${missing.length} item${missing.length === 1 ? '' : 's'} need attention` : ''}.
            </span>
          </div>
          <Link to="/portal/onboarding" style={{ textDecoration: 'none' }}><Button variant="primary" size="sm">Continue onboarding</Button></Link>
        </div>
      )}

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
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{statusLabel(status)}{missing.length > 0 ? ` · ${missing.length} missing` : ''}</span>
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
        <QuickAction to="/portal/onboarding" label="Continue onboarding" desc="Finish your setup" />
        <QuickAction to="/portal/content" label="Review content" desc={pendingReviews ? `${pendingReviews} pending` : 'Up to date'} />
        <QuickAction to="/portal/files" label="View files" desc="Shared assets" />
        <QuickAction to="/portal/reports" label="View reports" desc="Performance" />
      </div>

      {/* Wave 1 widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Pending content reviews */}
        <Widget title="Content to Review" action={<Link to="/portal/content" style={linkStyle}>Open →</Link>}>
          {pendingReviews === 0
            ? <Empty>No content awaiting your review.</Empty>
            : <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--violet)' }}>{pendingReviews}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>item{pendingReviews === 1 ? '' : 's'} need your approval</span>
              </div>}
        </Widget>

        {/* Recent files */}
        <Widget title="Recent Files" action={<Link to="/portal/files" style={linkStyle}>Open →</Link>}>
          {recentFiles.length === 0 ? <Empty>No files shared yet.</Empty> : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentFiles.map(f => (
                <li key={f.id}><button onClick={() => downloadFile(f, user?.agency_id && user?.client_id && user?.id ? { agencyId: user.agency_id, clientId: user.client_id, actorId: user.id, role: 'client' } : undefined)} style={fileBtn}>{f.name}</button></li>
              ))}
            </ul>
          )}
        </Widget>

        {/* Recent reports */}
        <Widget title="Recent Reports" action={<Link to="/portal/reports" style={linkStyle}>Open →</Link>}>
          {recentReports.length === 0 ? <Empty>No reports yet.</Empty> : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentReports.map(r => (
                <li key={r.id} style={{ fontSize: 13, color: 'var(--ink)' }}>{r.title}{r.period_label ? <span style={{ color: 'var(--muted)' }}> · {r.period_label}</span> : ''}</li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      {/* Recent activity */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20 }}>
        <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Recent Activity</h3>
        <ActivityFeed items={activity.items} loading={activity.loading} emptyLabel="No activity yet — complete a section of your onboarding to get started." />
      </div>
    </div>
  )
}

const linkStyle: React.CSSProperties = { fontSize: 12, color: 'var(--violet)', textDecoration: 'none', fontWeight: 600 }
const fileBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--violet)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 2 }

function Widget({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--muted)' }}>{children}</p>
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
