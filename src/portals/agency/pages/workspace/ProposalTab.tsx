import { useEffect, useState, useCallback } from 'react'
import * as PR from '@/features/proposals/api'
import * as CT from '@/features/contracts/api'
import { useServices, usePackages } from '@/features/operations/hooks'
import { money } from '@/features/operations/helpers'
import { updateProjectFields } from '@/features/projects/api'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Proposal, Contract, ProposalStatus, ContractStatus, Client } from '@/types'

const PROP_BADGE: Record<ProposalStatus, 'default' | 'info' | 'brand' | 'success' | 'danger'> = {
  draft: 'default', sent: 'brand', viewed: 'info', accepted: 'success',
  declined: 'danger', expired: 'default', archived: 'default',
}
const CONTRACT_BADGE: Record<ContractStatus, 'default' | 'info' | 'brand' | 'success' | 'danger'> = {
  draft: 'default', sent: 'brand', signed: 'success',
  declined: 'danger', expired: 'default', archived: 'default',
}

const PTABS = [{ id: 'proposals', label: 'Proposals' }, { id: 'contracts', label: 'Contracts' }]

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function ProposalTab({ client, ctx, onChanged }: Props) {
  const [ptab, setPtab]         = useState('proposals')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [openPropId, setOpenPropId] = useState<string | null>(null)

  const loadProposals = useCallback(async () => {
    const all = await PR.listProposals()
    setProposals(all.filter(p => p.client_id === client.id))
  }, [client.id])

  const loadContracts = useCallback(async () => {
    const all = await CT.listContracts()
    setContracts(all.filter(c => c.client_id === client.id))
  }, [client.id])

  useEffect(() => { loadProposals(); loadContracts() }, [loadProposals, loadContracts])

  async function handleCreateProposal(title: string) {
    const p = await PR.createProposal({ title, client_id: client.id }, ctx)
    await loadProposals()
    setOpenPropId(p.id)
    setShowCreate(false)
  }

  async function handleMarkSent(p: Proposal) {
    await PR.setProposalStatus(p, 'sent', ctx)
    // Set expiry using agency default
    const { error: exErr } = await supabase.rpc('set_proposal_expiry', { _proposal_id: p.id, _agency_id: ctx.agencyId })
    if (exErr) console.error('set_proposal_expiry:', exErr)
    // Auto-move stage to Proposal Sent if still in an earlier stage
    const curStage = client.pipeline_stages
    if (curStage && (curStage.name === 'New Inquiry / Lead' || curStage.name === 'Discovery Call')) {
      const { data: sentStage } = await supabase.from('pipeline_stages').select('id').eq('agency_id', ctx.agencyId).eq('name', 'Proposal Sent').maybeSingle()
      if (sentStage?.id) await updateProjectFields(client.id, { stage_id: sentStage.id }, ctx)
    }
    await loadProposals()
    onChanged()
  }

  async function handleMarkSigned(p: Proposal) {
    await PR.setProposalStatus(p, 'accepted', ctx)
    // Move stage to Proposal Signed
    const { data: signedStage } = await supabase.from('pipeline_stages').select('id').eq('agency_id', ctx.agencyId).eq('name', 'Proposal Signed').maybeSingle()
    if (signedStage?.id) await updateProjectFields(client.id, { stage_id: signedStage.id }, ctx)
    await loadProposals()
    onChanged()
  }

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 20 }}>
        {PTABS.map(t => (
          <button key={t.id} onClick={() => setPtab(t.id)} style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: ptab === t.id ? 600 : 400, color: ptab === t.id ? 'var(--violet)' : 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: ptab === t.id ? '2px solid var(--violet)' : '2px solid transparent', marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {ptab === 'proposals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New Proposal</Button>
          </div>
          {proposals.length === 0
            ? <Empty>No proposals for this project yet.</Empty>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposals.map(p => (
                  <ProposalRow key={p.id} proposal={p} onClick={() => setOpenPropId(p.id)}
                    onSent={() => handleMarkSent(p)} onSigned={() => handleMarkSigned(p)} />
                ))}
              </div>
            )
          }
        </div>
      )}

      {ptab === 'contracts' && (
        <div>
          {contracts.length === 0
            ? <Empty>No contracts linked to this project yet.</Empty>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contracts.map(c => (
                  <div key={c.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{c.title}</p>
                      {c.signed_at && <p style={{ fontSize: 12, color: '#059669' }}>Signed {new Date(c.signed_at).toLocaleDateString()}</p>}
                      {c.expires_at && c.status !== 'signed' && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Expires {new Date(c.expires_at).toLocaleDateString()}</p>}
                    </div>
                    <Badge variant={CONTRACT_BADGE[c.status]}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateProposalModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreateProposal}
        />
      )}
      {openPropId && (
        <ProposalBuilder id={openPropId} ctx={ctx} onChanged={loadProposals} onClose={() => setOpenPropId(null)} />
      )}
    </div>
  )
}

function ProposalRow({ proposal, onClick, onSent, onSigned }: { proposal: Proposal; onClick: () => void; onSent: () => void; onSigned: () => void }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={onClick}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{proposal.title}</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {money(proposal.total_cents)} · v{proposal.version}
            {proposal.expires_at && <> · Expires {new Date(proposal.expires_at).toLocaleDateString()}</>}
          </p>
        </div>
        <Badge variant={PROP_BADGE[proposal.status]}>{proposal.status}</Badge>
      </div>
      {proposal.status === 'draft' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline-2)' }}>
          <Button variant="outline" size="sm" onClick={onClick}>Edit</Button>
          <Button variant="primary" size="sm" onClick={onSent}>Mark Sent</Button>
        </div>
      )}
      {(proposal.status === 'sent' || proposal.status === 'viewed') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline-2)' }}>
          <Button variant="primary" size="sm" onClick={onSigned}>Mark Signed</Button>
          <Button variant="ghost" size="sm" onClick={onClick}>View</Button>
        </div>
      )}
    </div>
  )
}

function CreateProposalModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (title: string) => void }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy]   = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!title.trim()) return
    setBusy(true); try { await onSubmit(title.trim()) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="New Proposal" width={460}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="new-prop" loading={busy}>Create</Button></>}
    >
      <form id="new-prop" onSubmit={submit}>
        <Input label="Proposal title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
      </form>
    </Modal>
  )
}

function ProposalBuilder({ id, ctx, onChanged, onClose }: { id: string; ctx: { agencyId: string; actorId: string }; onChanged: () => void; onClose: () => void }) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [sections, setSections] = useState<import('@/types').ProposalSection[]>([])
  const [items, setItems]       = useState<import('@/types').ProposalLineItem[]>([])
  const { services } = useServices(); const { packages } = usePackages()
  const [pick, setPick] = useState('')

  const load = useCallback(async () => {
    const r = await PR.getProposal(id)
    setProposal(r.proposal); setSections(r.sections); setItems(r.items)
  }, [id])
  useEffect(() => { load() }, [load])

  async function addPick() {
    if (!pick) return; const [kind, pid] = pick.split(':')
    if (kind === 'service') { const s = services.find(x => x.id === pid); if (s) await PR.addServiceLine(id, s, ctx) }
    if (kind === 'package') { const p = packages.find(x => x.id === pid); if (p) await PR.addPackageLine(id, p, ctx) }
    setPick(''); await load(); onChanged()
  }

  if (!proposal) return <Modal open onClose={onClose} title="Proposal" width={700}><div style={{ height: 200 }} /></Modal>

  return (
    <Modal open onClose={onClose} title={proposal.title} subtitle={`${money(proposal.total_cents)} · ${proposal.status}`} width={700}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p style={sectionLabel}>Pricing</p>
          {items.map(it => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{it.name} <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {it.billing_kind}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{money(it.unit_price_cents)}</span>
                <button onClick={() => PR.removeLine(it).then(load).then(onChanged)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Select label="" value={pick} onChange={e => setPick(e.target.value)}
                options={[{ value: '', label: 'Add service or package…' }, ...services.filter(s => s.is_active).map(s => ({ value: `service:${s.id}`, label: `${s.name} (${money(s.price_cents)})` })), ...packages.filter(p => p.is_active).map(p => ({ value: `package:${p.id}`, label: `${p.name} (${money(p.price_cents)})` }))]} />
            </div>
            <Button variant="outline" size="sm" onClick={addPick} disabled={!pick}>Add</Button>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', marginTop: 10 }}>Total: {money(proposal.total_cents)}</p>
        </div>

        <div>
          <p style={sectionLabel}>Sections</p>
          {sections.map(s => (
            <div key={s.id} style={{ marginBottom: 10 }}>
              <Textarea label={s.title} defaultValue={s.body ?? ''} rows={2} onBlur={e => PR.updateSection(s.id, e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
          <Button variant="primary" size="sm" onClick={() => PR.setProposalStatus(proposal, 'sent', ctx).then(load).then(onChanged)}>Mark sent</Button>
          <Button variant="outline" size="sm" onClick={() => PR.setProposalStatus(proposal, 'accepted', ctx).then(load).then(onChanged)}>Accepted</Button>
          <Button variant="outline" size="sm" onClick={() => PR.setProposalStatus(proposal, 'declined', ctx).then(load).then(onChanged)}>Declined</Button>
          <Button variant="ghost" size="sm" onClick={() => PR.saveVersion(proposal, ctx).then(load)}>Save version</Button>
        </div>
      </div>
    </Modal>
  )
}

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '44px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{children}</div> }
