import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { useActivity } from '@/features/activity/hooks'
import { useGoals, useKpis } from '@/features/goals/hooks'
import { listProposalsByClient } from '@/features/proposals/api'
import { listContractsByClient } from '@/features/contracts/api'
import { listInvoices } from '@/features/billing/api'
import { contactName, HEALTH_LABEL, HEALTH_BADGE, relativeTime } from '@/features/clients/helpers'
import { money } from '@/features/operations/helpers'
import type { Client, Proposal, Contract, Invoice, GoalStatus } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onSectionChange: (id: string) => void
}

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', viewed: 'Viewed', accepted: 'Accepted',
  declined: 'Declined', expired: 'Expired', archived: 'Archived',
}
const PROPOSAL_STATUS_BADGE: Record<string, 'default' | 'info' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', sent: 'brand', viewed: 'info', accepted: 'success',
  declined: 'danger', expired: 'warning', archived: 'default',
}
const CONTRACT_STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'brand' | 'info'> = {
  draft: 'default', sent: 'brand', signed: 'success', declined: 'danger', expired: 'warning', archived: 'default',
}
const GOAL_STATUS_BADGE: Record<GoalStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  on_track: 'success', at_risk: 'warning', achieved: 'success', missed: 'danger',
}
const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: 'On track', at_risk: 'At risk', achieved: 'Achieved', missed: 'Missed',
}

const CONNECTED_PLATFORMS = [
  'Google Analytics', 'Meta Ads', 'Google Search Console', 'TikTok Ads', 'YouTube', 'Mailchimp',
]

const truncate = (s: unknown, len = 120): string => {
  const str = typeof s === 'string' ? s.trim() : ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

const dv = (data: Record<string, unknown>, key: string): string | null => {
  const v = data[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const CARD: React.CSSProperties = {
  background: 'var(--surface-solid)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  padding: 20,
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: 12,
}

const SUB_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: 5,
}

const LINK_BTN: React.CSSProperties = {
  marginTop: 14,
  background: 'none',
  border: 'none',
  color: 'var(--violet)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  padding: 0,
  display: 'block',
}

export function BusinessOverview({ client, ctx: _ctx, onSectionChange }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)

  const { goals, loading: goalsLoading } = useGoals(client.id)
  const { kpis } = useKpis(client.id)
  const { items: activityItems, loading: activityLoading } = useActivity({ clientId: client.id, limit: 6 })

  useEffect(() => {
    setDealsLoading(true)
    Promise.all([
      listProposalsByClient(client.id),
      listContractsByClient(client.id),
      listInvoices(client.id),
    ])
      .then(([p, c, i]) => { setProposals(p); setContracts(c); setInvoices(i) })
      .catch(() => {})
      .finally(() => setDealsLoading(false))
  }, [client.id])

  // Contacts
  const contacts = client.client_contacts ?? []
  const keyContacts = contacts
    .filter(c => c.is_primary || c.roles?.includes('decision_maker'))
    .slice(0, 3)
  const displayContacts = keyContacts.length > 0 ? keyContacts : contacts.slice(0, 2)

  // Goals
  const goalCounts = goals.reduce(
    (acc, g) => { acc[g.status] = (acc[g.status] ?? 0) + 1; return acc },
    {} as Partial<Record<GoalStatus, number>>,
  )

  // Deals
  const latestProposal = proposals[0] ?? null
  const latestContract = contracts[0] ?? null
  const activeRetainer = invoices.find(
    i => i.is_recurring && ['sent', 'viewed', 'partially_paid'].includes(i.status),
  ) ?? null
  const outstandingInvoice = invoices.find(
    i => ['overdue', 'sent'].includes(i.status) && i.amount_paid_cents < i.total_cents,
  ) ?? null

  const brandVoice    = dv(client.discovery_data, 'brand_voice')
  const brandMission  = dv(client.discovery_data, 'brand_mission')
  const brandTagline  = dv(client.discovery_data, 'current_tagline')
  const hasBrand      = !!(brandVoice || brandMission || brandTagline)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* ── Company ───────────────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Company</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          {client.business_name}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {client.industry && <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.industry}</span>}
          {client.industry && client.location && <span style={{ color: 'var(--hairline)' }}>·</span>}
          {client.location && <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.location}</span>}
          <Badge variant={HEALTH_BADGE[client.health]}>{HEALTH_LABEL[client.health]}</Badge>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {client.website && (
            <Row label="Website">
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12.5, color: 'var(--violet)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {client.website.replace(/^https?:\/\//, '')}
              </a>
            </Row>
          )}
          {client.business_phone && <Row label="Phone"><span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.business_phone}</span></Row>}
          {client.project_value_cents > 0 && (
            <Row label="Value"><span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>{money(client.project_value_cents)}</span></Row>
          )}
          {client.client_since && (
            <Row label="Client since">
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                {new Date(client.client_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </Row>
          )}
          {client.last_activity_at && (
            <Row label="Last activity"><span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{relativeTime(client.last_activity_at)}</span></Row>
          )}
        </div>
        <button style={LINK_BTN} onClick={() => onSectionChange('company')}>View company details →</button>
      </div>

      {/* ── Key Contacts ──────────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Key Contacts</p>
        {displayContacts.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>No contacts added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {displayContacts.map(contact => (
              <div key={contact.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{contactName(contact)}</span>
                  {contact.is_primary && <Badge variant="brand">Primary</Badge>}
                </div>
                {contact.title && <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>{contact.title}</p>}
                {contact.email && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{contact.email}</p>}
              </div>
            ))}
          </div>
        )}
        {contacts.length > displayContacts.length ? (
          <button style={LINK_BTN} onClick={() => onSectionChange('contacts')}>
            View all {contacts.length} contacts →
          </button>
        ) : contacts.length > 0 ? (
          <button style={LINK_BTN} onClick={() => onSectionChange('contacts')}>Manage contacts →</button>
        ) : null}
      </div>

      {/* ── Brand Snapshot ────────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Brand</p>
        {!hasBrand ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>No brand data captured yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {brandVoice && (
              <div>
                <p style={SUB_LABEL}>Voice</p>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{truncate(brandVoice)}</p>
              </div>
            )}
            {brandMission && (
              <div>
                <p style={SUB_LABEL}>Mission</p>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{truncate(brandMission)}</p>
              </div>
            )}
            {brandTagline && (
              <div>
                <p style={SUB_LABEL}>Tagline</p>
                <p style={{ fontSize: 13.5, color: 'var(--ink)', fontStyle: 'italic', fontWeight: 500 }}>"{brandTagline}"</p>
              </div>
            )}
          </div>
        )}
        <button style={LINK_BTN} onClick={() => onSectionChange('brand')}>View brand center →</button>
      </div>

      {/* ── Goals & KPIs ──────────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Goals & KPIs</p>
        {goalsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ height: 28, borderRadius: 8, background: 'var(--lavender-soft)', opacity: 0.5 }} />
            ))}
          </div>
        ) : goals.length === 0 && kpis.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>No goals set yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {goals.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>
                  {goals.length} goal{goals.length !== 1 ? 's' : ''}
                </span>
                {(['on_track', 'at_risk', 'achieved', 'missed'] as GoalStatus[])
                  .filter(s => goalCounts[s])
                  .map(s => (
                    <Badge key={s} variant={GOAL_STATUS_BADGE[s]}>
                      {goalCounts[s]} {GOAL_STATUS_LABEL[s]}
                    </Badge>
                  ))}
              </div>
            )}
            {kpis.length > 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                {kpis.length} KPI{kpis.length !== 1 ? 's' : ''} configured
              </p>
            )}
          </div>
        )}
        <button style={LINK_BTN} onClick={() => onSectionChange('goals')}>Manage goals →</button>
      </div>

      {/* ── Deals Snapshot ────────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Deals</p>
        {dealsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 24, borderRadius: 8, background: 'var(--lavender-soft)', opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DealRow label="Latest Proposal">
              {latestProposal ? (
                <TwoCol
                  left={latestProposal.title}
                  right={
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Badge variant={PROPOSAL_STATUS_BADGE[latestProposal.status] ?? 'default'}>
                        {PROPOSAL_STATUS_LABEL[latestProposal.status] ?? latestProposal.status}
                      </Badge>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                        {money(latestProposal.total_cents)}
                      </span>
                    </div>
                  }
                />
              ) : <Empty>No proposals yet.</Empty>}
            </DealRow>

            <DealRow label="Latest Contract">
              {latestContract ? (
                <TwoCol
                  left={latestContract.title}
                  right={
                    <Badge variant={CONTRACT_STATUS_BADGE[latestContract.status] ?? 'default'}>
                      {latestContract.status}
                    </Badge>
                  }
                />
              ) : <Empty>No contracts yet.</Empty>}
            </DealRow>

            <DealRow label="Active Retainer">
              {activeRetainer ? (
                <TwoCol
                  left={activeRetainer.title ?? activeRetainer.number ?? 'Recurring invoice'}
                  right={
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                      {money(activeRetainer.total_cents)}/mo
                    </span>
                  }
                />
              ) : <Empty>No active retainer.</Empty>}
            </DealRow>

            {outstandingInvoice && (
              <DealRow label="Outstanding">
                <TwoCol
                  left={outstandingInvoice.title ?? outstandingInvoice.number ?? 'Invoice'}
                  right={
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {outstandingInvoice.status === 'overdue' && <Badge variant="danger">Overdue</Badge>}
                      <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                        {money(outstandingInvoice.total_cents - outstandingInvoice.amount_paid_cents)} owed
                      </span>
                    </div>
                  }
                />
              </DealRow>
            )}
          </div>
        )}
        <button style={LINK_BTN} onClick={() => onSectionChange('deals')}>View all deals →</button>
      </div>

      {/* ── Connected Accounts ────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Connected Accounts</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {CONNECTED_PLATFORMS.map(name => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Not connected</span>
            </div>
          ))}
        </div>
        <button style={LINK_BTN} onClick={() => onSectionChange('connected_accounts')}>
          Set up connections →
        </button>
      </div>

      {/* ── Recent Activity (full width) ──────────────────────── */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <p style={SECTION_LABEL}>Recent Activity</p>
        <ActivityFeed
          items={activityItems}
          loading={activityLoading}
          emptyLabel="No recent activity for this client."
        />
      </div>

    </div>
  )
}

/* ── Small helpers ───────────────────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <span style={{ fontSize: 11.5, color: 'var(--muted)', width: 76, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

function DealRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={SUB_LABEL}>{label}</p>
      {children}
    </div>
  )
}

function TwoCol({ left, right }: { left: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {left}
      </span>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{children}</p>
}
