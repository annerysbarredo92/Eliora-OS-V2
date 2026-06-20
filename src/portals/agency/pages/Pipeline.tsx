import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import * as P from '@/features/pipeline/api'
import { money } from '@/features/operations/helpers'
import { LeadModal } from '@/features/pipeline/components/LeadModal'
import { LeadDetail } from '@/features/pipeline/components/LeadDetail'
import { ProposalsView } from '@/features/proposals/components/ProposalsView'
import { ContractsView } from '@/features/contracts/components/ContractsView'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Lead, PipelineStage } from '@/types'

const TABS = [{ id: 'pipeline', label: 'Pipeline' }, { id: 'proposals', label: 'Proposals' }, { id: 'contracts', label: 'Contracts' }]

export function AgencyPipeline() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [tab, setTab] = useState('pipeline')
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Lead | null>(null)
  const [detail, setDetail] = useState<Lead | null>(null)

  const agencyId = profile?.agency_id ?? null
  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null

  const load = useCallback(async () => {
    if (!agencyId) return
    await P.seedStages(agencyId)
    const [s, l] = await Promise.all([P.listStages(), P.listLeads()])
    setStages(s); setLeads(l); setLoading(false)
  }, [agencyId])
  useEffect(() => { load() }, [load])

  const valueByStage = (sid: string) => leads.filter(l => l.stage_id === sid).reduce((n, l) => n + l.estimated_value_cents, 0)

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Pipeline</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Leads, proposals, and contracts.</p>
        </div>
        {tab === 'pipeline' && <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>＋ Add lead</Button>}
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--violet)' : 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: tab === t.id ? '2px solid var(--violet)' : '2px solid transparent', marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {tab === 'pipeline' && (
        loading ? <Skel /> : stages.length === 0 ? <Empty>Setting up your pipeline…</Empty> : (
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {stages.map(s => {
              const col = leads.filter(l => l.stage_id === s.id)
              return (
                <div key={s.id} style={{ minWidth: 240, flex: '0 0 240px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{s.name}</span>
                    <Badge variant="default">{col.length}</Badge>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{money(valueByStage(s.id))} · {s.probability}%</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
                    {col.map(l => (
                      <div key={l.id} onClick={() => setDetail(l)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 12, cursor: 'pointer' }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{l.business_name}</p>
                        {l.name && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{l.name}</p>}
                        <p style={{ fontSize: 12, color: 'var(--violet)', fontWeight: 600, marginTop: 6 }}>{money(l.estimated_value_cents)}</p>
                      </div>
                    ))}
                    {col.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 2px' }}>No leads</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'proposals' && ctx && <ProposalsView ctx={ctx} clients={clients} leads={leads} />}
      {tab === 'contracts' && ctx && <ContractsView ctx={ctx} clients={clients} />}

      {ctx && <LeadModal open={showCreate} mode="create" stages={stages} onClose={() => setShowCreate(false)} onSubmit={async v => { await P.createLead(v, ctx); await load() }} />}
      {ctx && editTarget && <LeadModal open mode="edit" stages={stages} initial={leadToForm(editTarget)} onClose={() => setEditTarget(null)} onSubmit={async v => { await P.updateLead(editTarget.id, v, ctx); await load() }} />}
      {ctx && detail && <LeadDetail lead={detail} stages={stages} ctx={ctx} onEdit={() => { setEditTarget(detail); setDetail(null) }} onChanged={load} onClose={() => setDetail(null)} />}
    </div>
  )
}

export function leadToForm(l: Lead): P.LeadFormValues {
  return { business_name: l.business_name, name: l.name ?? '', email: l.email ?? '', phone: l.phone ?? '', website: l.website ?? '', source: l.source ?? '', stage_id: l.stage_id ?? '', estimated_value_cents: l.estimated_value_cents, owner_id: l.owner_id ?? '', notes: l.notes ?? '' }
}

function Skel() { return <div style={{ display: 'flex', gap: 14 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ minWidth: 240, height: 200, borderRadius: 16, background: 'var(--lavender-soft)', opacity: 0.4 }} />)}</div> }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '44px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{children}</div> }
