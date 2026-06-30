import { useEffect, useState, useCallback } from 'react'
import * as PR from '../api'
import { useServices, usePackages } from '@/features/operations/hooks'
import { money } from '@/features/operations/helpers'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Proposal, ProposalSection, ProposalLineItem, Client, Lead, ProposalStatus } from '@/types'

const STATUS_BADGE: Record<ProposalStatus, 'default' | 'info' | 'brand' | 'success' | 'danger'> = {
  draft: 'default', sent: 'brand', viewed: 'info', accepted: 'success', declined: 'danger', expired: 'default', archived: 'default',
}

export function ProposalsView({ ctx, clients, leads }: { ctx: { agencyId: string; actorId: string }; clients: Client[]; leads: Lead[] }) {
  const [list, setList] = useState<Proposal[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => { setList(await PR.listProposals()) }, [])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Build proposals from your services and packages.</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New proposal</Button>
      </div>
      {list.length === 0 ? <Empty>No proposals yet.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(p => (
            <div key={p.id} onClick={() => setOpenId(p.id)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.title}</p><p style={{ fontSize: 12, color: 'var(--muted)' }}>{money(p.total_cents)} · v{p.version}</p></div>
              <Badge variant={STATUS_BADGE[p.status]}>{p.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal ctx={ctx} clients={clients} leads={leads} onClose={() => setShowCreate(false)} onCreated={async id => { await load(); setOpenId(id) }} />}
      {openId && <Builder id={openId} ctx={ctx} onChanged={load} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function CreateModal({ ctx, clients, leads, onClose, onCreated }: { ctx: { agencyId: string; actorId: string }; clients: Client[]; leads: Lead[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState(''); const [link, setLink] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!title.trim()) return; setBusy(true)
    try {
      const [kind, id] = link ? link.split(':') : ['', '']
      const p = await PR.createProposal({ title, lead_id: kind === 'lead' ? id : null, client_id: kind === 'client' ? id : null }, ctx)
      onCreated(p.id); onClose()
    } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="New proposal" width={480} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="prop-create" loading={busy}>Create</Button></>}>
      <form id="prop-create" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
        <Select label="Link to (optional)" value={link} onChange={e => setLink(e.target.value)}
          options={[{ value: '', label: 'None' }, ...leads.map(l => ({ value: `lead:${l.id}`, label: `Lead — ${l.business_name}` })), ...clients.map(c => ({ value: `client:${c.id}`, label: `Client — ${c.business_name}` }))]} />
      </form>
    </Modal>
  )
}

function Builder({ id, ctx, onChanged, onClose }: { id: string; ctx: { agencyId: string; actorId: string }; onChanged: () => void; onClose: () => void }) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [sections, setSections] = useState<ProposalSection[]>([])
  const [items, setItems] = useState<ProposalLineItem[]>([])
  const { services } = useServices(); const { packages } = usePackages()
  const [pick, setPick] = useState('')

  const load = useCallback(async () => { const r = await PR.getProposal(id); setProposal(r.proposal); setSections(r.sections); setItems(r.items) }, [id])
  useEffect(() => { load() }, [load])

  async function addPick() {
    if (!pick) return; const [kind, pid] = pick.split(':')
    if (kind === 'service') { const s = services.find(x => x.id === pid); if (s) await PR.addServiceLine(id, s, ctx) }
    if (kind === 'package') { const p = packages.find(x => x.id === pid); if (p) await PR.addPackageLine(id, p, ctx) }
    setPick(''); await load(); onChanged()
  }

  if (!proposal) return <Modal open onClose={onClose} title="Proposal" width={680}><div style={{ height: 200 }} /></Modal>

  return (
    <Modal open onClose={onClose} title={proposal.title} subtitle={`${money(proposal.total_cents)} · ${proposal.status}`} width={700}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Line items */}
        <div>
          <p style={k}>Pricing (from Services & Packages)</p>
          {items.map(it => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{it.name} <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {it.billing_kind === 'recurring' ? 'recurring' : 'one-time'}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>{money(it.unit_price_cents)}</span><button onClick={() => PR.removeLine(it).then(load).then(onChanged)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>×</button></span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Select label="" value={pick} onChange={e => setPick(e.target.value)} options={[{ value: '', label: 'Add service or package…' }, ...services.filter(s => s.is_active).map(s => ({ value: `service:${s.id}`, label: `Service — ${s.name} (${money(s.price_cents)})` })), ...packages.filter(p => p.is_active).map(p => ({ value: `package:${p.id}`, label: `Package — ${p.name} (${money(p.price_cents)})` }))]} /></div>
            <Button variant="outline" size="sm" onClick={addPick} disabled={!pick}>Add</Button>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', marginTop: 10 }}>Total: {money(proposal.total_cents)}</p>
        </div>

        {/* Sections */}
        <div>
          <p style={k}>Sections</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.map(s => (
              <div key={s.id}>
                <Textarea label={s.title} defaultValue={s.body ?? ''} rows={2} onBlur={e => PR.updateSection(s.id, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Status actions */}
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

const k: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{children}</div> }
