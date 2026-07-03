import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Invoice, ContentItem, Task, CalendarEvent, ClientRequest, Proposal, Client } from '@/types'

type Tier = 'critical' | 'important' | 'informational'

interface ActionItem {
  key:        string
  tier:       Tier
  label:      string
  detail:     string
  href:       string
}

const TIER_ORDER: Record<Tier, number> = { critical: 0, important: 1, informational: 2 }

const DOT: Record<Tier, string> = {
  critical:      '#ef4444',
  important:     '#f59e0b',
  informational: '#818cf8',
}
const TIER_LABEL: Record<Tier, string> = {
  critical:      'Critical',
  important:     'Important',
  informational: 'Informational',
}

function clientName(clientId: string | null, clients: Client[]): string {
  if (!clientId) return ''
  return clients.find(c => c.id === clientId)?.business_name ?? ''
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function hoursAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isPast(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

interface Props {
  invoices:  Invoice[]
  content:   ContentItem[]
  tasks:     Task[]
  events:    CalendarEvent[]
  requests:  ClientRequest[]
  proposals: Proposal[]
  clients:   Client[]
  loading:   boolean
}

export function PriorityActionsWidget({ invoices, content, tasks, events, requests, proposals, clients, loading }: Props) {
  const navigate = useNavigate()

  const items = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = []

    // ── CRITICAL ─────────────────────────────────────────────────

    // Overdue invoices
    invoices
      .filter(inv => inv.due_date && isPast(inv.due_date) && !['paid','void','archived','draft'].includes(inv.status))
      .forEach(inv => {
        const name = clientName(inv.client_id, clients)
        list.push({
          key: `inv-${inv.id}`,
          tier: 'critical',
          label: `Invoice overdue ${formatMoney(inv.total_cents - inv.amount_paid_cents)}`,
          detail: [name, inv.number, `${daysAgo(inv.due_date!)}d past due`].filter(Boolean).join(' · '),
          href: '/agency/billing',
        })
      })

    // At-risk clients (health = 'critical')
    clients
      .filter(c => c.health === 'critical' && c.status !== 'archived')
      .forEach(c => {
        list.push({
          key: `health-${c.id}`,
          tier: 'critical',
          label: 'Client at risk',
          detail: c.business_name,
          href: `/agency/projects/${c.id}`,
        })
      })

    // Overdue content approvals (client_review > 48h)
    content
      .filter(ci => ci.status === 'client_review' && hoursAgo(ci.updated_at) >= 48)
      .forEach(ci => {
        const name = clientName(ci.client_id, clients)
        list.push({
          key: `review-${ci.id}`,
          tier: 'critical',
          label: 'Client approval overdue',
          detail: [name, ci.title, `${Math.round(hoursAgo(ci.updated_at) / 24)}d waiting`].filter(Boolean).join(' · '),
          href: `/agency/projects/${ci.client_id}`,
        })
      })

    // ── IMPORTANT ────────────────────────────────────────────────

    // Open client requests
    requests
      .filter(r => !['completed','closed'].includes(r.status))
      .forEach(r => {
        const name = clientName(r.client_id, clients)
        list.push({
          key: `req-${r.id}`,
          tier: 'important',
          label: 'Open client request',
          detail: [name, r.title].filter(Boolean).join(' · '),
          href: r.client_id ? `/agency/projects/${r.client_id}` : '/agency/projects',
        })
      })

    // Meetings today (calendar events)
    events
      .filter(e => ['discovery_call','client_meeting'].includes(e.type) && isToday(e.start_at))
      .forEach(e => {
        const name = clientName(e.client_id, clients)
        const time = e.start_at ? new Date(e.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Today'
        list.push({
          key: `event-${e.id}`,
          tier: 'important',
          label: e.title,
          detail: [name, time].filter(Boolean).join(' · '),
          href: '/agency/calendar',
        })
      })

    // Overdue tasks
    tasks
      .filter(t => t.status !== 'done' && t.due_date && isPast(t.due_date))
      .forEach(t => {
        const name = clientName(t.client_id, clients)
        list.push({
          key: `task-${t.id}`,
          tier: 'important',
          label: t.title,
          detail: [name, `${daysAgo(t.due_date!)}d overdue`].filter(Boolean).join(' · '),
          href: '/agency/tasks',
        })
      })

    // ── INFORMATIONAL ────────────────────────────────────────────

    // Content scheduled soon (today → +3 days)
    const in3Days = new Date(); in3Days.setDate(in3Days.getDate() + 3)
    content
      .filter(ci => ci.scheduled_date && !isPast(ci.scheduled_date) && new Date(ci.scheduled_date) <= in3Days && !['archived','published'].includes(ci.status))
      .forEach(ci => {
        const name = clientName(ci.client_id, clients)
        const dateStr = new Date(ci.scheduled_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        list.push({
          key: `soon-${ci.id}`,
          tier: 'informational',
          label: 'Content scheduled soon',
          detail: [name, ci.title, dateStr].filter(Boolean).join(' · '),
          href: ci.client_id ? `/agency/projects/${ci.client_id}` : '/agency/content',
        })
      })

    // Proposal follow-ups (sent > 3 days ago, not yet decided)
    proposals
      .filter(p => p.status === 'sent' && p.sent_at && daysAgo(p.sent_at) >= 3)
      .forEach(p => {
        const name = clientName(p.client_id, clients)
        list.push({
          key: `prop-${p.id}`,
          tier: 'informational',
          label: 'Proposal follow-up due',
          detail: [name, p.title, `Sent ${daysAgo(p.sent_at!)}d ago`].filter(Boolean).join(' · '),
          href: p.client_id ? `/agency/projects/${p.client_id}` : '/agency/projects',
        })
      })

    // Sort: critical → important → informational, then take max 7
    return list.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]).slice(0, 7)
  }, [invoices, content, tasks, events, requests, proposals, clients])

  const tiers = useMemo<Tier[]>(() => {
    const seen = new Set<Tier>()
    items.forEach(i => seen.add(i.tier))
    return (['critical','important','informational'] as Tier[]).filter(t => seen.has(t))
  }, [items])

  return (
    <WidgetShell title="Priority Actions" loading={loading}>
      {items.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 22, marginBottom: 6 }}>✓</p>
          <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>All clear</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div>
          {tiers.map(tier => (
            <div key={tier}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#d1d5db', margin: '10px 0 4px' }}>{TIER_LABEL[tier]}</p>
              {items.filter(i => i.tier === tier).map(item => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.href)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%',
                    padding: '7px 0', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--hairline)', textAlign: 'left',
                    transition: 'background 120ms ease', fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT[item.tier], flexShrink: 0, marginTop: 5 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.detail}</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}

function WidgetShell({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{title}</p>
      {loading ? <Skeleton /> : children}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
      {[80, 65, 90, 55, 75].map((w, i) => (
        <div key={i} style={{ height: 36, width: `${w}%`, borderRadius: 8, background: 'var(--lavender-soft)', opacity: 0.45 }} />
      ))}
    </div>
  )
}
