import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { Card } from '@/components/ui/Card'
import { useHomeDashboard } from './home/useHomeDashboard'
import { DailyBriefWidget } from './home/DailyBriefWidget'
import { PriorityActionsWidget } from './home/PriorityActionsWidget'
import { TodayScheduleWidget } from './home/TodayScheduleWidget'
import { AgencySnapshotWidget } from './home/AgencySnapshotWidget'
import { PipelineSnapshotWidget } from './home/PipelineSnapshotWidget'
import { ClientHealthWidget } from './home/ClientHealthWidget'
import { NewActionDropdown } from './home/NewActionDropdown'
import type { AiGeneration } from '@/types'

export function AgencyHome() {
  const { profile } = useAuth()
  const dash = useHomeDashboard()

  const [briefOverride, setBriefOverride] = useState<AiGeneration | null>(null)
  const brief = briefOverride ?? dash.todaysBrief

  const agencyId = profile?.agency_id ?? ''
  const actorId  = profile?.id ?? ''
  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const completion     = dash.setup.progress?.completion_pct ?? 0
  const completedSteps = dash.setup.progress?.completed_steps ?? 0
  const totalSteps     = dash.setup.progress?.total_steps ?? 0
  const setupDone      = totalSteps > 0 && completion >= 100

  // Context object for AI daily brief (summarises current agency state)
  const dailyBriefContext: Record<string, unknown> = {
    activeClients:   dash.clientMetrics.active,
    leadClients:     dash.clientMetrics.lead,
    onboardingClients: dash.clientMetrics.onboarding,
    openRequests:    dash.requests.filter(r => !['completed','closed'].includes(r.status)).length,
    overdueInvoices: dash.invoices.filter(inv =>
      inv.due_date && new Date(inv.due_date) < new Date() &&
      !['paid','void','archived','draft'].includes(inv.status)
    ).length,
    monthlyRevenueCents: dash.monthlyRevenue,
    outstandingCents:    dash.billingMetrics.outstanding,
    pipelineStages:  dash.pipelineSummary.map(s => ({ name: s.name, count: s.count })),
    atRiskClients:   dash.clients.filter(c => c.health === 'critical' && c.status !== 'archived').length,
  }

  function handleRefresh() {
    dash.refresh()
  }

  return (
    <div className="animate-fade-up">
      {/* Header row: greeting + New button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(21px,2.6vw,30px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>
            {greeting}, {firstName}.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {agencyId && actorId && (
          <NewActionDropdown
            agencyId={agencyId}
            actorId={actorId}
            clients={dash.clients}
            onRefresh={handleRefresh}
          />
        )}
      </div>

      {/* Setup progress banner */}
      {!setupDone && (
        <div style={{
          background: '#0B0913', border: '1px solid rgba(109,61,230,0.3)',
          borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 20, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .35, filter: 'blur(60px)', top: -80, left: -40, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
              Setup Progress
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 14 }}>
              Complete your workspace setup to unlock everything.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 180, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
                <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 2, transition: 'width 400ms ease' }} />
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {totalSteps > 0 ? `${completedSteps} of ${totalSteps} steps complete` : 'Loading…'}
              </span>
            </div>
          </div>
          <Link to="/agency/agency" style={{ textDecoration: 'none', position: 'relative', zIndex: 1 }}>
            <button
              style={{ padding: '9px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(109,61,230,0.3)', color: '#F3F1FA', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'all 150ms ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(109,61,230,0.5)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(109,61,230,0.3)' }}
            >
              Continue setup →
            </button>
          </Link>
        </div>
      )}

      {/* AI Daily Brief */}
      {agencyId && actorId && (
        <div style={{ marginBottom: 18 }}>
          <DailyBriefWidget
            brief={brief}
            context={dailyBriefContext}
            agencyId={agencyId}
            actorId={actorId}
            onGenerated={g => setBriefOverride(g)}
          />
        </div>
      )}

      {/* Agency Snapshot */}
      <div style={{ marginBottom: 14 }}>
        <AgencySnapshotWidget
          monthlyRevenue={dash.monthlyRevenue}
          billingMetrics={dash.billingMetrics}
          pipelineSummary={dash.pipelineSummary}
          clientMetrics={dash.clientMetrics}
          tasks={dash.tasks}
          requests={dash.requests}
          loading={dash.loading}
        />
      </div>

      {/* Pipeline Snapshot */}
      <div style={{ marginBottom: 18 }}>
        <PipelineSnapshotWidget
          summary={dash.pipelineSummary}
          loading={dash.loading}
        />
      </div>

      {/* Two-column: Priority Actions + Today's Schedule + Client Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18, alignItems: 'start' }}>
        {/* Left: Priority Actions */}
        <PriorityActionsWidget
          invoices={dash.invoices}
          content={dash.content}
          tasks={dash.tasks}
          events={dash.events}
          requests={dash.requests}
          proposals={dash.proposals}
          clients={dash.clients}
          loading={dash.loading}
        />

        {/* Right: Today's Schedule + Client Health stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TodayScheduleWidget
            events={dash.events}
            tasks={dash.tasks}
            content={dash.content}
            proposals={dash.proposals}
            clients={dash.clients}
            loading={dash.loading}
          />
          <ClientHealthWidget
            clients={dash.clients}
            loading={dash.clientsLoading}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <Card glass>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Activity</h3>
          <Link to="/agency/projects" style={{ fontSize: 12, color: 'var(--violet)', textDecoration: 'none', fontWeight: 600 }}>View projects →</Link>
        </div>
        <ActivityFeed
          items={dash.activity.items}
          loading={dash.activity.loading}
          emptyLabel="No activity yet — add your first project to get started."
        />
      </Card>
    </div>
  )
}
