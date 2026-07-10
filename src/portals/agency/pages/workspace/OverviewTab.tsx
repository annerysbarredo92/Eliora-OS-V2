import { useAgencyOnboarding } from '@/features/onboarding/hooks'
import { readProgress, statusLabel as obStatusLabel } from '@/features/onboarding/helpers'
import { useActivity } from '@/features/activity/hooks'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { money } from '@/features/operations/helpers'
import {
  primaryContact, contactName, statusLabel, relativeTime,
  STATUS_BADGE, HEALTH_LABEL,
} from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types'

interface Props {
  client: Client
  onTabChange: (tab: string) => void
  isActiveClient: boolean
}

export function OverviewTab({ client, onTabChange, isActiveClient }: Props) {
  const agencyOb = useAgencyOnboarding(client.id)
  const obStats  = readProgress(agencyOb.progress)
  const activity = useActivity({ clientId: client.id, limit: 8 })
  const pc       = primaryContact(client)
  const stage    = client.pipeline_stages

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20 }} className="ws-grid">
      {/* ── Left column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Project snapshot */}
        <Panel title="Project Snapshot">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
            <SnapCard label="Stage" value={stage?.name ?? '—'} />
            <SnapCard label="Status" value={statusLabel(client.status)} />
            <SnapCard label="Health" value={HEALTH_LABEL[client.health]} />
            <SnapCard label="Project Value" value={client.project_value_cents > 0 ? money(client.project_value_cents) : '—'} />
            <SnapCard label="Close Probability" value={client.close_probability != null ? `${client.close_probability}%` : '—'} />
            <SnapCard label="Lead Score" value={client.lead_score != null ? `${client.lead_score}/100` : '—'} />
          </div>
        </Panel>

        {/* Business information */}
        <Panel title="Business Information">
          <InfoRow label="Business name" value={client.business_name} />
          <InfoRow label="Industry"      value={client.industry} />
          <InfoRow label="Website"       value={client.website} link />
          <InfoRow label="Phone"         value={client.business_phone} />
          <InfoRow label="Location"      value={client.location ?? client.business_address} />
          <InfoRow label="Lead source"   value={client.lead_source} />
        </Panel>

        {/* Primary contact */}
        <Panel title="Primary Contact">
          <InfoRow label="Name"  value={contactName(pc)} />
          <InfoRow label="Email" value={pc?.email ?? null} />
          <InfoRow label="Phone" value={pc?.phone ?? null} />
          <InfoRow label="Title" value={pc?.title ?? null} />
        </Panel>

        {/* Sales notes */}
        {!!(client.lead_info as Record<string, unknown>)?.sales_notes && (
          <Panel title="Sales Notes">
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {String((client.lead_info as Record<string, unknown>).sales_notes)}
            </p>
          </Panel>
        )}

        {/* Internal notes */}
        <Panel title="Internal Notes">
          <p style={{ fontSize: 13.5, color: client.internal_notes ? 'var(--ink-2)' : 'var(--muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {client.internal_notes || 'No internal notes yet.'}
          </p>
        </Panel>
      </div>

      {/* ── Right column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Sales pipeline position */}
        {stage && (
          <Panel title="Pipeline Position">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Badge variant={STATUS_BADGE[client.status]}>{statusLabel(client.status)}</Badge>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--violet)' }}>{stage.name}</span>
            </div>
            <div style={{ height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${stage.probability}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 999 }} />
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{stage.probability}% probability</p>
            {client.expected_close_date && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                Expected close: <strong style={{ color: 'var(--ink-2)' }}>{new Date(client.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              </p>
            )}
            {client.next_follow_up_at && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Follow-up: <strong style={{ color: 'var(--violet)' }}>{relativeTime(client.next_follow_up_at)}</strong>
              </p>
            )}
            <Button variant="ghost" size="sm" style={{ marginTop: 10 }} onClick={() => onTabChange(isActiveClient ? 'business' : 'lead_info')}>
              {isActiveClient ? 'View business info →' : 'View lead info →'}
            </Button>
          </Panel>
        )}

        {/* Onboarding progress */}
        {client.status !== 'lead' && (
          <Panel title="Client Onboarding">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant={obStats.status === 'completed' ? 'success' : 'default'}>{obStatusLabel(obStats.status)}</Badge>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--violet)' }}>{obStats.pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${obStats.pct}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 999, transition: 'width 400ms ease' }} />
            </div>
            {obStats.missing.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                {obStats.missing.length} item{obStats.missing.length !== 1 ? 's' : ''} outstanding
              </p>
            )}
            <Button variant="ghost" size="sm" style={{ marginTop: 10 }} onClick={() => onTabChange('onboarding')}>
              View onboarding →
            </Button>
          </Panel>
        )}

        {/* Next action */}
        {client.next_action && (
          <Panel title="Next Action">
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{client.next_action}</p>
          </Panel>
        )}

        {/* Quick links */}
        <Panel title="Quick Navigation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(isActiveClient ? [
              { tab: 'business',        label: 'Business'        },
              { tab: 'marketing',       label: 'Marketing'       },
              { tab: 'onboarding',      label: 'Onboarding'      },
              { tab: 'client_success',  label: 'Messages'        },
              { tab: 'insights',        label: 'Insights'        },
              { tab: 'ai',              label: 'Ask AI'          },
            ] : [
              { tab: 'lead_info',  label: 'Lead Information' },
              { tab: 'discovery',  label: 'Discovery'        },
              { tab: 'proposal',   label: 'Proposals'        },
              { tab: 'messages',   label: 'Messages'         },
              { tab: 'onboarding', label: 'Onboarding'       },
              { tab: 'ai',         label: 'Ask AI'           },
            ]).map(({ tab, label }) => (
              <button key={tab} onClick={() => onTabChange(tab)} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', fontSize: 13, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                {label} →
              </button>
            ))}
          </div>
        </Panel>

        {/* Recent activity */}
        <Panel title="Recent Activity">
          <ActivityFeed items={activity.items.slice(0, 6)} loading={activity.loading} />
        </Panel>
      </div>

      <style>{`@media(max-width:860px){.ws-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 20 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>{title}</h3>
      {children}
    </section>
  )
}

function SnapCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  const display = value?.trim() ? value : '—'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      {link && value
        ? <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--violet)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</a>
        : <span style={{ fontSize: 13, color: display === '—' ? 'var(--muted)' : 'var(--ink)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{display}</span>}
    </div>
  )
}
