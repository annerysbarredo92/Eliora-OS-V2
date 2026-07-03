import { money } from '@/features/operations/helpers'
import type { BillingMetrics } from '@/features/billing/api'
import type { StageSummary } from '@/features/projects/api'
import type { Task, ClientRequest, DashboardMetrics } from '@/types'

interface Props {
  monthlyRevenue:  number
  billingMetrics:  BillingMetrics
  pipelineSummary: StageSummary[]
  clientMetrics:   DashboardMetrics
  tasks:           Task[]
  requests:        ClientRequest[]
  loading:         boolean
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso), now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export function AgencySnapshotWidget({ monthlyRevenue, billingMetrics, pipelineSummary, clientMetrics, tasks, requests, loading }: Props) {
  const pipelineValue = pipelineSummary.reduce((n, s) => n + s.total_cents, 0)
  const tasksDueToday = tasks.filter(t => t.status !== 'done' && isToday(t.due_date)).length
  const openRequests  = requests.filter(r => !['completed','closed'].includes(r.status)).length

  const row1: { label: string; value: string; accent?: string }[] = [
    { label: 'Revenue (MTD)',      value: loading ? '—' : money(monthlyRevenue),                accent: '#059669' },
    { label: 'Outstanding',        value: loading ? '—' : money(billingMetrics.outstanding),    accent: billingMetrics.outstanding > 0 ? '#e11d48' : 'var(--ink)' },
    { label: 'Pipeline Value',     value: loading ? '—' : money(pipelineValue),                  accent: '#6d3de6' },
    { label: 'Active Clients',     value: loading ? '—' : String(clientMetrics.active),          accent: 'var(--ink)' },
  ]

  const row2: { label: string; value: string; accent?: string }[] = [
    { label: 'Open Leads',         value: loading ? '—' : String(clientMetrics.lead),            accent: '#6d3de6' },
    { label: 'Onboarding',         value: loading ? '—' : String(clientMetrics.onboarding),      accent: '#d97706' },
    { label: 'Open Requests',      value: loading ? '—' : String(openRequests),                  accent: openRequests > 0 ? '#e11d48' : 'var(--ink)' },
    { label: 'Tasks Due Today',    value: loading ? '—' : String(tasksDueToday),                 accent: tasksDueToday > 0 ? '#d97706' : 'var(--ink)' },
  ]

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Agency Snapshot</p>

      {/* Row 1 — Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--hairline)' }}>
        {row1.map(k => (
          <div key={k.label} style={{ padding: '0 4px' }}>
            <p style={{ fontSize: loading ? 14 : 17, fontWeight: 700, color: k.accent ?? 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 3, lineHeight: 1 }}>
              {k.value}
            </p>
            <p style={{ fontSize: 9.5, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Row 2 — Operations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
        {row2.map(k => (
          <div key={k.label} style={{ padding: '0 4px' }}>
            <p style={{ fontSize: loading ? 14 : 17, fontWeight: 700, color: k.accent ?? 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 3, lineHeight: 1 }}>
              {k.value}
            </p>
            <p style={{ fontSize: 9.5, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
