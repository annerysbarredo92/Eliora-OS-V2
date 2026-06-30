import { useEffect, useState, useCallback } from 'react'
import * as C from '../api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { relativeTime } from '@/features/clients/helpers'
import type { Contract, ContractTemplate, Client, ContractStatus } from '@/types'

const SB: Record<ContractStatus, 'default' | 'brand' | 'success' | 'danger'> = { draft: 'default', sent: 'brand', signed: 'success', declined: 'danger', expired: 'default', archived: 'default' }

export function ContractsView({ ctx, clients }: { ctx: { agencyId: string; actorId: string }; clients: Client[] }) {
  const [sub, setSub] = useState<'contracts' | 'templates'>('contracts')
  const [list, setList] = useState<Contract[]>([])
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<Contract | null>(null)
  const [editTpl, setEditTpl] = useState<ContractTemplate | null | 'new'>(null)

  const load = useCallback(async () => { setList(await C.listContracts()); setTemplates(await C.listContractTemplates()) }, [])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['contracts', 'templates'] as const).map(s => <button key={s} onClick={() => setSub(s)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1px solid', borderColor: sub === s ? 'var(--violet)' : 'var(--hairline)', background: sub === s ? 'var(--violet)' : 'var(--surface-solid)', color: sub === s ? '#fff' : 'var(--ink-2)' }}>{s === 'contracts' ? 'Contracts' : 'Templates'}</button>)}
        </div>
        <Button variant="primary" size="sm" onClick={() => sub === 'contracts' ? setShowCreate(true) : setEditTpl('new')}>{sub === 'contracts' ? 'New contract' : 'New template'}</Button>
      </div>

      {sub === 'contracts' ? (
        list.length === 0 ? <Empty>No contracts yet.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{list.map(c => (
            <div key={c.id} onClick={() => setDetail(c)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{c.title}</p><p style={{ fontSize: 12, color: 'var(--muted)' }}>{c.signed_at ? `Signed ${relativeTime(c.signed_at)}` : relativeTime(c.created_at)}</p></div>
              <Badge variant={SB[c.status]}>{c.status}</Badge>
            </div>
          ))}</div>
        )
      ) : (
        templates.length === 0 ? <Empty>No templates yet.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{templates.map(t => (
            <div key={t.id} onClick={() => setEditTpl(t)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</p>
            </div>
          ))}</div>
        )
      )}

      {showCreate && <CreateContract ctx={ctx} clients={clients} templates={templates} onClose={() => setShowCreate(false)} onCreated={load} />}
      {detail && <ContractDetail contract={detail} ctx={ctx} onChanged={load} onClose={() => setDetail(null)} />}
      {editTpl && <TemplateModal ctx={ctx} template={editTpl === 'new' ? null : editTpl} onClose={() => setEditTpl(null)} onSaved={load} />}
    </div>
  )
}

function CreateContract({ ctx, clients, templates, onClose, onCreated }: { ctx: { agencyId: string; actorId: string }; clients: Client[]; templates: ContractTemplate[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(''); const [clientId, setClientId] = useState(''); const [tplId, setTplId] = useState(''); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false)
  function applyTpl(id: string) { setTplId(id); const t = templates.find(x => x.id === id); if (t) setBody(t.body ?? '') }
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!title.trim()) return; setBusy(true); try { await C.createContract({ title, body, client_id: clientId || null, template_id: tplId || null }, ctx); onCreated(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title="New contract" width={560} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="ctr-create" loading={busy}>Create</Button></>}>
      <form id="ctr-create" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Select label="Client (optional)" value={clientId} onChange={e => setClientId(e.target.value)} options={[{ value: '', label: 'None' }, ...clients.map(c => ({ value: c.id, label: c.business_name }))]} />
          <Select label="From template" value={tplId} onChange={e => applyTpl(e.target.value)} options={[{ value: '', label: 'Blank' }, ...templates.map(t => ({ value: t.id, label: t.name }))]} />
        </div>
        <Textarea label="Contract body" value={body} onChange={e => setBody(e.target.value)} rows={5} />
      </form>
    </Modal>
  )
}

function ContractDetail({ contract, ctx, onChanged, onClose }: { contract: Contract; ctx: { agencyId: string; actorId: string }; onChanged: () => void; onClose: () => void }) {
  const [signing, setSigning] = useState(false); const [name, setName] = useState(''); const [busy, setBusy] = useState(false)
  async function sign(e: React.FormEvent) { e.preventDefault(); if (!name.trim()) return; setBusy(true); try { await C.signContract(contract, name, '', false, ctx); onChanged(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title={contract.title} subtitle={contract.status} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{contract.body || 'No content.'}</p>
        {!signing ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
            {contract.status !== 'signed' && <Button variant="primary" size="sm" onClick={() => C.setContractStatus(contract, 'sent', ctx).then(onChanged).then(onClose)}>Mark sent</Button>}
            {contract.status !== 'signed' && <Button variant="outline" size="sm" onClick={() => setSigning(true)}>Sign (in-app)</Button>}
            {contract.status === 'signed' && <Badge variant="success">Signed{contract.signed_at ? ` ${relativeTime(contract.signed_at)}` : ''}</Badge>}
          </div>
        ) : (
          <form onSubmit={sign} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
            <Input label="Type full name to sign" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><Button variant="ghost" size="sm" onClick={() => setSigning(false)}>Cancel</Button><Button variant="primary" size="sm" type="submit" loading={busy}>Sign contract</Button></div>
          </form>
        )}
      </div>
    </Modal>
  )
}

function TemplateModal({ ctx, template, onClose, onSaved }: { ctx: { agencyId: string; actorId: string }; template: ContractTemplate | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? ''); const [body, setBody] = useState(template?.body ?? ''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!name.trim()) return; setBusy(true); try { await C.saveContractTemplate(template?.id ?? null, name, body, ctx); onSaved(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title={template ? 'Edit template' : 'New template'} width={600} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="tpl" loading={busy}>Save</Button></>}>
      <form id="tpl" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Template name" value={name} onChange={e => setName(e.target.value)} autoFocus required />
        <Textarea label="Body" value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Standard agreement terms…" />
      </form>
    </Modal>
  )
}

function Empty({ children }: { children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{children}</div> }
