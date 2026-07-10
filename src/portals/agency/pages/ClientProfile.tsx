import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClient } from '@/features/clients/hooks'
import { updateClient, archiveClient, clientToFormValues } from '@/features/clients/api'
import { moveProjectStage } from '@/features/projects/api'
import { useProjectStages } from '@/features/projects/hooks'
import { primaryContact, contactName, statusLabel, STATUS_BADGE, HEALTH_BADGE, HEALTH_LABEL, relativeTime } from '@/features/clients/helpers'
import { money } from '@/features/operations/helpers'
import { ClientFormModal } from '@/features/clients/components/ClientFormModal'
import { enablePortal } from '@/features/portal/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
// Lead-stage workspace tabs
import { OverviewTab }      from './workspace/OverviewTab'
import { LeadInfoTab }      from './workspace/LeadInfoTab'
import { DiscoveryTab }     from './workspace/DiscoveryTab'
import { ProposalTab }      from './workspace/ProposalTab'
import { OnboardingTab }    from './workspace/OnboardingTab'
import { CommunicationTab } from './workspace/CommunicationTab'
import { ActivityTab }      from './workspace/ActivityTab'
import { AiTab }            from './workspace/AiTab'
// Client-stage workspace tabs
import { BusinessTab }      from './workspace/BusinessTab'
import { MarketingTab }     from './workspace/MarketingTab'
import { CreativeTab }      from './workspace/CreativeTab'
import { DigitalTab }       from './workspace/DigitalTab'
import { OpsTab }           from './workspace/OpsTab'
import { ClientSuccessTab } from './workspace/ClientSuccessTab'
import { InsightsTab }      from './workspace/InsightsTab'
import type { ClientFormValues } from '@/features/clients/api'

// ── URL tab slug ↔ component tab ID ─────────────────────────────────────────
const SLUG_TO_ID: Record<string, string> = {
  'lead-info':      'lead_info',
  'client-success': 'client_success',
  'operations':     'client_ops',
}
const ID_TO_SLUG: Record<string, string> = {
  lead_info:      'lead-info',
  client_success: 'client-success',
  client_ops:     'operations',
}
function slugToId(slug: string): string { return SLUG_TO_ID[slug] ?? slug }
function idToSlug(id: string): string   { return ID_TO_SLUG[id]   ?? id   }

const LEAD_TABS = [
  { id: 'overview',   label: 'Overview'  },
  { id: 'lead_info',  label: 'Lead Info' },
  { id: 'discovery',  label: 'Discovery' },
  { id: 'proposal',   label: 'Proposals' },
  { id: 'onboarding', label: 'Onboarding'},
  { id: 'messages',   label: 'Communication' },
  { id: 'activity',   label: 'Activity'  },
  { id: 'ai',         label: 'AI'        },
]

const CLIENT_TABS = [
  { id: 'overview',        label: 'Overview'        },
  { id: 'business',        label: 'Business'        },
  { id: 'onboarding',      label: 'Onboarding'      },
  { id: 'marketing',       label: 'Marketing'       },
  { id: 'creative',        label: 'Creative'        },
  { id: 'digital',         label: 'Digital'         },
  { id: 'client_ops',      label: 'Operations'      },
  { id: 'client_success',  label: 'Client Success'  },
  { id: 'insights',        label: 'Insights'        },
  { id: 'ai',              label: 'AI'              },
]

export function AgencyWorkspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const { profile }   = useAuth()
  const navigate      = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { client, loading, error, refresh } = useClient(projectId)
  const { stages }    = useProjectStages()

  const [tab, setTab]                 = useState(() => slugToId(searchParams.get('tab') ?? 'overview'))
  const [editing, setEditing]         = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving]     = useState(false)
  const [enabling, setEnabling]       = useState(false)
  const [stageOpen, setStageOpen]     = useState(false)
  const [newStageId, setNewStageId]   = useState('')
  const [stageSaving, setStageSaving] = useState(false)

  const ctx = profile?.agency_id && profile?.id
    ? { agencyId: profile.agency_id, actorId: profile.id }
    : null

  async function handleEnablePortal() {
    if (!ctx || !client) return
    setEnabling(true)
    try { await enablePortal(client.id, ctx); await refresh() } finally { setEnabling(false) }
  }

  async function handleEdit(values: ClientFormValues) {
    if (!ctx || !client) throw new Error('No context')
    await updateClient(client.id, values, ctx)
    await refresh()
  }

  async function handleArchive() {
    if (!ctx || !client) return
    setArchiving(true)
    try { await archiveClient(client, ctx); setArchiveOpen(false); navigate('/agency/projects') }
    finally { setArchiving(false) }
  }

  async function handleMoveStage() {
    if (!ctx || !client || !newStageId) return
    setStageSaving(true)
    try {
      const stage = stages.find(s => s.id === newStageId)
      await moveProjectStage(client.id, newStageId, stage?.name ?? '', ctx)
      await refresh()
      setStageOpen(false)
    } finally { setStageSaving(false) }
  }

  if (loading) {
    return (
      <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ height: 110, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.5 }} />
        <div style={{ height: 46, borderRadius: 10, background: 'var(--lavender-soft)', opacity: 0.35 }} />
        <div style={{ height: 300, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="animate-fade-up" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Project not found</p>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
          {error ? String(error) : 'This project may have been removed or you do not have access.'}
        </p>
        <Button variant="primary" onClick={() => navigate('/agency/projects')}>Back to Projects</Button>
      </div>
    )
  }

  const pc    = primaryContact(client)
  const stage = client.pipeline_stages

  // Safer detection: active status OR legacy 'Client' stage name
  const isActiveClient = client.status === 'active' || stage?.name === 'Client'
  const TABS           = isActiveClient ? CLIENT_TABS : LEAD_TABS

  // If current tab doesn't exist in the active tab set, fall back to overview
  const resolvedTab = TABS.find(t => t.id === tab) ? tab : 'overview'

  function changeTab(id: string) {
    setTab(id)
    setSearchParams({ tab: idToSlug(id) }, { replace: true })
  }

  const valueLabel   = isActiveClient ? 'Retainer Value' : 'Project Value'
  const healthLabel  = isActiveClient ? 'Client Health'  : 'Close %'
  const healthValue  = isActiveClient
    ? (client.health !== 'unknown' ? HEALTH_LABEL[client.health] : '—')
    : (client.close_probability != null ? `${client.close_probability}%` : '—')

  return (
    <div className="animate-fade-up">
      {/* ── Workspace Header ── */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '18px 20px', marginBottom: 16 }}>
        {/* Identity + actions row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#6D3DE6,#9258EE)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
              {client.business_name.slice(0, 1).toUpperCase()}
            </div>
            {/* Identity */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{client.business_name}</h1>
                {stage && (
                  <button onClick={() => { setNewStageId(stage.id); setStageOpen(true) }} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--violet)', background: 'rgba(109,61,230,0.1)', border: '1px solid rgba(109,61,230,0.25)', borderRadius: 999, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {stage.name} ▾
                  </button>
                )}
                <Badge variant={STATUS_BADGE[client.status]}>{statusLabel(client.status)}</Badge>
                {client.health !== 'unknown' && <Badge variant={HEALTH_BADGE[client.health]}>{HEALTH_LABEL[client.health]}</Badge>}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                {[client.industry, client.location ?? client.business_address, client.website].filter(Boolean).join(' · ')}
              </p>
              {pc && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
                  {contactName(pc)}{pc.email ? ` · ${pc.email}` : ''}{pc.phone ? ` · ${pc.phone}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!client.portal_enabled && (
              <Button variant="outline" size="sm" onClick={handleEnablePortal} loading={enabling}>Enable Portal</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => changeTab(isActiveClient ? 'client_success' : 'messages')}>Message</Button>
            <Button variant="ghost" size="sm" onClick={() => changeTab('ai')}>Ask AI</Button>
            {client.status !== 'archived' && (
              <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)}>Archive</Button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, marginTop: 16 }}>
          <KpiPill label={valueLabel}     value={client.project_value_cents > 0 ? money(client.project_value_cents) : '—'} />
          <KpiPill label="Portal"         value={client.portal_enabled ? 'Enabled' : 'Off'} />
          <KpiPill label={healthLabel}    value={healthValue} />
          <KpiPill label="Lead Score"     value={client.lead_score != null ? `${client.lead_score}/100` : '—'} />
          <KpiPill label="Last Activity"  value={relativeTime(client.last_activity_at)} />
          {client.client_since && <KpiPill label="Client Since" value={new Date(client.client_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} />}
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--hairline)', marginBottom: 22, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            style={{
              padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
              fontWeight: resolvedTab === t.id ? 600 : 400,
              color: resolvedTab === t.id ? 'var(--violet)' : 'var(--ink-2)',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: resolvedTab === t.id ? '2px solid var(--violet)' : '2px solid transparent',
              marginBottom: -1, letterSpacing: '-0.01em',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {ctx && (
        <>
          {/* Overview is shared across both modes */}
          {resolvedTab === 'overview' && (
            <OverviewTab client={client} onTabChange={changeTab} isActiveClient={isActiveClient} />
          )}

          {/* Lead-stage tabs */}
          {!isActiveClient && resolvedTab === 'lead_info'  && <LeadInfoTab   client={client} ctx={ctx} onChanged={refresh} />}
          {!isActiveClient && resolvedTab === 'discovery'  && <DiscoveryTab  client={client} ctx={ctx} onChanged={refresh} />}
          {!isActiveClient && resolvedTab === 'proposal'   && <ProposalTab   client={client} ctx={ctx} onChanged={refresh} />}
          {!isActiveClient && resolvedTab === 'messages'   && <CommunicationTab client={client} ctx={ctx} />}
          {!isActiveClient && resolvedTab === 'activity'   && <ActivityTab   client={client} />}

          {/* Onboarding is available in both modes (gated internally by stage) */}
          {resolvedTab === 'onboarding' && <OnboardingTab client={client} ctx={ctx} />}

          {/* Client-stage workspace tabs */}
          {isActiveClient && resolvedTab === 'business'       && <BusinessTab      client={client} ctx={ctx} onChanged={refresh} />}
          {isActiveClient && resolvedTab === 'marketing'      && <MarketingTab     client={client} ctx={ctx} />}
          {isActiveClient && resolvedTab === 'creative'       && <CreativeTab      client={client} ctx={ctx} />}
          {isActiveClient && resolvedTab === 'digital'        && <DigitalTab />}
          {isActiveClient && resolvedTab === 'client_ops'     && <OpsTab           client={client} />}
          {isActiveClient && resolvedTab === 'client_success' && <ClientSuccessTab client={client} ctx={ctx} />}
          {isActiveClient && resolvedTab === 'insights'       && <InsightsTab      client={client} ctx={ctx} />}

          {/* AI is shared across both modes */}
          {resolvedTab === 'ai' && <AiTab client={client} />}
        </>
      )}

      {/* ── Modals ── */}
      <ClientFormModal open={editing} mode="edit" initial={clientToFormValues(client)} onClose={() => setEditing(false)} onSubmit={handleEdit} />

      <Modal open={stageOpen} onClose={() => setStageOpen(false)} title="Move to Stage" width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStageOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleMoveStage} loading={stageSaving} disabled={!newStageId || newStageId === stage?.id}>Move</Button>
          </>
        }
      >
        <Select label="Select stage" value={newStageId} onChange={e => setNewStageId(e.target.value)}
          options={stages.map(s => ({ value: s.id, label: s.name }))} />
      </Modal>

      <Modal
        open={archiveOpen}
        onClose={() => archiving ? undefined : setArchiveOpen(false)}
        title="Archive project?"
        subtitle={`${client.business_name} will be archived. No data is deleted.`}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={archiving}>Cancel</Button>
            <Button variant="danger" onClick={handleArchive} loading={archiving}>Archive</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Archived projects stay in your records and can be reactivated anytime by editing their status inside the workspace.
        </p>
      </Modal>
    </div>
  )
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '9px 12px' }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</p>
    </div>
  )
}
