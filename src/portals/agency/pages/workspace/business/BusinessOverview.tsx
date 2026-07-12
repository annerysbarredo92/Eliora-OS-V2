import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { useActivity } from '@/features/activity/hooks'
import { useGoals, useKpis } from '@/features/goals/hooks'
import { listProposalsByClient } from '@/features/proposals/api'
import { listContractsByClient } from '@/features/contracts/api'
import { listInvoices } from '@/features/billing/api'
import { listRetainers } from '@/features/retainers/api'
import { contactName, HEALTH_LABEL, HEALTH_BADGE, relativeTime } from '@/features/clients/helpers'
import { money } from '@/features/operations/helpers'
import { FREQUENCY_LABELS } from '@/features/retainers/api'
import { computeBusinessHealth, computeAIReadiness } from './businessHealth'
import type { Client, Proposal, Contract, Invoice, Retainer, GoalStatus } from '@/types'

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

const truncate = (s: unknown, len = 120): string => {
  const str = typeof s === 'string' ? s.trim() : ''
  return str.length > len ? str.slice(0, len) + '…' : str
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

function healthColor(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--danger)'
}

export function BusinessOverview({ client, ctx: _ctx, onSectionChange }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [retainers, setRetainers] = useState<Retainer[]>([])
  const [accountLoading, setAccountLoading] = useState(true)
  const [proposalsError, setProposalsError] = useState(false)
  const [contractsError, setContractsError] = useState(false)
  const [invoicesError, setInvoicesError] = useState(false)
  const [retainersError, setRetainersError] = useState(false)

  const { goals, loading: goalsLoading } = useGoals(client.id)
  const { kpis } = useKpis(client.id)
  const { items: activityItems, loading: activityLoading } = useActivity({ clientId: client.id, limit: 6 })

  useEffect(() => {
    setAccountLoading(true)
    setProposalsError(false)
    setContractsError(false)
    setInvoicesError(false)
    setRetainersError(false)

    Promise.allSettled([
      listProposalsByClient(client.id),
      listContractsByClient(client.id),
      listInvoices(client.id),
      listRetainers(client.id),
    ]).then(([pResult, cResult, iResult, rResult]) => {
      if (pResult.status === 'fulfilled') setProposals(pResult.value)
      else { console.error('listProposalsByClient:', pResult.reason); setProposalsError(true) }

      if (cResult.status === 'fulfilled') setContracts(cResult.value)
      else { console.error('listContractsByClient:', cResult.reason); setContractsError(true) }

      if (iResult.status === 'fulfilled') setInvoices(iResult.value)
      else { console.error('listInvoices:', iResult.reason); setInvoicesError(true) }

      if (rResult.status === 'fulfilled') setRetainers(rResult.value)
      else { console.error('listRetainers:', rResult.reason); setRetainersError(true) }
    }).finally(() => setAccountLoading(false))
  }, [client.id])

  const contacts = client.client_contacts ?? []
  const keyContacts = contacts
    .filter(c => c.is_primary || c.roles?.includes('decision_maker'))
    .slice(0, 3)
  const displayContacts = keyContacts.length > 0 ? keyContacts : contacts.slice(0, 2)

  const goalCounts = goals.reduce(
    (acc, g) => { acc[g.status] = (acc[g.status] ?? 0) + 1; return acc },
    {} as Partial<Record<GoalStatus, number>>,
  )

  const latestProposal  = proposals[0] ?? null
  const latestContract  = contracts[0] ?? null
  const activeRetainer  = retainers.find(r => r.status === 'active') ?? null
  const outstandingInvoice = invoices.find(
    i => ['overdue', 'sent'].includes(i.status) && i.amount_paid_cents < i.total_cents,
  ) ?? null

  const dd = client.discovery_data as Record<string, unknown>
  const _bv = (dd.brand_voice ?? {}) as Record<string, unknown>
  const _bs = (dd.brand_strategy ?? {}) as Record<string, unknown>
  const brandVoice   = typeof _bv.voice_descriptor === 'string' && _bv.voice_descriptor.trim() ? _bv.voice_descriptor.trim() : null
  const brandMission = typeof _bs.mission === 'string' && _bs.mission.trim() ? _bs.mission.trim() : null
  const brandTagline = Array.isArray(_bs.taglines) && typeof _bs.taglines[0] === 'string' && _bs.taglines[0].trim() ? _bs.taglines[0].trim() : null
  const hasBrand     = !!(brandVoice || brandMission || brandTagline)

  const health    = computeBusinessHealth(client)
  const readiness = computeAIReadiness(client)

  // Priority alert: pick the single highest-priority real issue.
  // Never fire from a data source that failed to load — that would show a false alert.
  const priorityAlert: string | null = (() => {
    if (!accountLoading && !invoicesError) {
      const overdue = invoices.find(i => i.status === 'overdue')
      if (overdue) return `Overdue invoice: ${overdue.title ?? overdue.number ?? 'Invoice'} — ${money(overdue.total_cents - overdue.amount_paid_cents)} owed`
    }
    if (!accountLoading && !contractsError) {
      const expiredContract = contracts.find(c => c.status === 'expired')
      if (expiredContract) return `Contract expired: ${expiredContract.title}`
    }
    if (contacts.length > 0 && !contacts.some(c => c.is_primary)) {
      return 'No primary contact set — assign one in the Contacts section.'
    }
    if (contacts.length === 0) return 'No contacts added yet — add at least one to track this account.'
    return null
  })()

  // Setup checklist: show for new/incomplete clients
  const showChecklist = health.score < 50 || client.status === 'onboarding' || client.status === 'lead'
  const checklistItems = health.dimensions
    .filter(d => d.status !== 'complete')
    .map(d => ({ label: d.label, tip: d.tip, sectionId: d.sectionId }))
    .slice(0, 5)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* ── Priority Alert ────────────────────────────────────── */}
      {priorityAlert && (
        <div
          style={{
            ...CARD,
            gridColumn: '1 / -1',
            borderColor: 'var(--danger)',
            background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: '14px 20px',
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>
            {priorityAlert}
          </p>
        </div>
      )}

      {/* ── Business Health ───────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={SECTION_LABEL}>Business Health</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: healthColor(health.score), lineHeight: 1 }}>
              {health.score}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>/100</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {health.dimensions.map(dim => (
            <div key={dim.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <button
                  onClick={() => onSectionChange(dim.sectionId)}
                  style={{
                    fontSize: 12, color: 'var(--ink-2)', fontWeight: 500,
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', textAlign: 'left',
                  }}
                >
                  {dim.label}
                </button>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{dim.score}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--hairline)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${dim.score}%`,
                  borderRadius: 99,
                  background: healthColor(dim.score),
                  transition: 'width 400ms ease',
                }} />
              </div>
              {dim.tip && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{dim.tip}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Readiness ──────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={SECTION_LABEL}>AI Readiness</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: healthColor(readiness.score), lineHeight: 1 }}>
              {readiness.complete}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>/{readiness.total} signals</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {readiness.signals.map(sig => (
            <div key={sig.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, flexShrink: 0, color: sig.complete ? 'var(--success)' : 'var(--muted)' }}>
                {sig.complete ? '✓' : '○'}
              </span>
              <button
                onClick={() => !sig.complete && onSectionChange(sig.sectionId)}
                style={{
                  fontSize: 12.5,
                  color: sig.complete ? 'var(--ink-2)' : 'var(--muted)',
                  fontWeight: sig.complete ? 500 : 400,
                  background: 'none', border: 'none', padding: 0,
                  cursor: sig.complete ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)', textAlign: 'left',
                  textDecoration: sig.complete ? 'none' : 'underline',
                  textDecorationStyle: 'dotted',
                }}
              >
                {sig.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Company Snapshot ──────────────────────────────────── */}
      <div style={CARD}>
        <p style={SECTION_LABEL}>Company</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          {client.business_name}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {client.industry && <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.industry}</span>}
          {client.industry && client.sub_industry && <span style={{ color: 'var(--hairline)' }}>·</span>}
          {client.sub_industry && <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.sub_industry}</span>}
          {(client.industry || client.sub_industry) && client.location && <span style={{ color: 'var(--hairline)' }}>·</span>}
          {client.location && <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.location}</span>}
          <Badge variant={HEALTH_BADGE[client.health]}>{HEALTH_LABEL[client.health]}</Badge>
        </div>
        {client.company_description && (
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 12 }}>
            {truncate(client.company_description, 160)}
          </p>
        )}
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
          {client.business_email && (
            <Row label="Email"><span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.business_email}</span></Row>
          )}
          {client.business_phone && (
            <Row label="Phone"><span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.business_phone}</span></Row>
          )}
          {client.timezone && (
            <Row label="Timezone"><span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{client.timezone}</span></Row>
          )}
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
                {contact.preferred_communication && (
                  <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Prefers: {contact.preferred_communication}</p>
                )}
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
        ) : (
          <button style={LINK_BTN} onClick={() => onSectionChange('contacts')}>Add contacts →</button>
        )}
      </div>

      {/* ── Brand Preview ─────────────────────────────────────── */}
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

      {/* ── Active Goals ──────────────────────────────────────── */}
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

      {/* ── Account Summary ───────────────────────────────────── */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <p style={SECTION_LABEL}>Account</p>
        {accountLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 8, background: 'var(--lavender-soft)', opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            <DealCard label="Latest Proposal">
              {proposalsError
                ? <ErrorLine>Could not load proposals.</ErrorLine>
                : latestProposal
                  ? (
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
                  )
                  : <EmptyLine>No proposals yet.</EmptyLine>}
            </DealCard>

            <DealCard label="Latest Contract">
              {contractsError
                ? <ErrorLine>Could not load contracts.</ErrorLine>
                : latestContract
                  ? (
                    <TwoCol
                      left={latestContract.title}
                      right={
                        <Badge variant={CONTRACT_STATUS_BADGE[latestContract.status] ?? 'default'}>
                          {latestContract.status}
                        </Badge>
                      }
                    />
                  )
                  : <EmptyLine>No contracts yet.</EmptyLine>}
            </DealCard>

            <DealCard label="Active Retainer">
              {retainersError
                ? <ErrorLine>Could not load retainers.</ErrorLine>
                : activeRetainer
                  ? (
                    <TwoCol
                      left={activeRetainer.title}
                      right={
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                          {money(activeRetainer.amount_cents)}/{FREQUENCY_LABELS[activeRetainer.frequency].toLowerCase()}
                        </span>
                      }
                    />
                  )
                  : <EmptyLine>No active retainer on file.</EmptyLine>}
            </DealCard>

            {!invoicesError && outstandingInvoice && (
              <DealCard label="Outstanding">
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
              </DealCard>
            )}
          </div>
        )}
        <button style={LINK_BTN} onClick={() => onSectionChange('proposals')}>View proposals →</button>
      </div>

      {/* ── Setup Checklist ───────────────────────────────────── */}
      {showChecklist && checklistItems.length > 0 && (
        <div style={{ ...CARD, gridColumn: '1 / -1', borderStyle: 'dashed' }}>
          <p style={SECTION_LABEL}>Setup Checklist</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Complete these items to get the most out of this client workspace.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checklistItems.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 14, color: 'var(--muted)', marginTop: 1 }}>○</span>
                <div>
                  <button
                    onClick={() => onSectionChange(item.sectionId)}
                    style={{
                      fontSize: 13, fontWeight: 500, color: 'var(--violet)',
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}
                  >
                    {item.label}
                  </button>
                  {item.tip && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{item.tip}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Activity ───────────────────────────────────── */}
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

function DealCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
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

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{children}</p>
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{children}</p>
}
