import { useState, useEffect, useCallback } from 'react'
import * as CT from '@/features/contracts/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Client, Contract, ContractStatus, ContractTemplate, ContractSignature } from '@/types'

const STATUS_BADGE: Record<ContractStatus, 'default' | 'info' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', sent: 'brand', signed: 'success',
  declined: 'danger', expired: 'warning', archived: 'default',
}
const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Draft', sent: 'Sent', signed: 'Signed',
  declined: 'Declined', expired: 'Expired', archived: 'Archived',
}

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function ContractsSection({ client, ctx, onChanged }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [openId, setOpenId]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [c, t] = await Promise.all([
        CT.listContractsByClient(client.id),
        CT.listContractTemplates(),
      ])
      setContracts(c); setTemplates(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  async function handleCreate(title: string, body: string, templateId: string | null) {
    await CT.createContract({ title, body, client_id: client.id, template_id: templateId }, ctx)
    await load()
    setShowCreate(false)
    onChanged()
  }

  async function handleStatus(c: Contract, status: ContractStatus) {
    await CT.setContractStatus(c, status, ctx)
    await load()
    onChanged()
  }

  const openContract = contracts.find(c => c.id === openId) ?? null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Contracts</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Service agreements for {client.business_name}.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New Contract</Button>
      </div>

      {loading && <Skel />}

      {!loading && error && (
        <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && contracts.length === 0 && (
        <EmptyState
          title="No contracts yet"
          description="Create a service agreement to document the terms of your engagement."
          action={<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>Create first contract</Button>}
        />
      )}

      {!loading && !error && contracts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              onClick={() => setOpenId(c.id)}
              onStatus={status => handleStatus(c, status)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateContractModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {openId && openContract && (
        <ContractDetailModal
          contract={openContract}
          ctx={ctx}
          onStatus={status => handleStatus(openContract, status)}
          onChanged={async () => { await load(); onChanged() }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

/* ── Contract card ───────────────────────────────────────── */

function ContractCard({ contract, onClick, onStatus }: {
  contract: Contract
  onClick: () => void
  onStatus: (s: ContractStatus) => void
}) {
  const [busy, setBusy] = useState(false)
  async function act(s: ContractStatus) {
    setBusy(true); try { await onStatus(s) } finally { setBusy(false) }
  }
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={onClick}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{contract.title}</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {contract.signed_at
              ? `Signed ${new Date(contract.signed_at).toLocaleDateString()}`
              : contract.sent_at
                ? `Sent ${new Date(contract.sent_at).toLocaleDateString()}`
                : `Created ${new Date(contract.created_at).toLocaleDateString()}`}
            {contract.expires_at && contract.status !== 'signed' && <> · Expires {new Date(contract.expires_at).toLocaleDateString()}</>}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[contract.status]}>{STATUS_LABEL[contract.status]}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)' }}>
        <Button variant="outline" size="sm" onClick={onClick}>
          {contract.status === 'draft' ? 'Edit' : 'View'}
        </Button>
        {contract.status === 'draft' && (
          <Button variant="primary" size="sm" loading={busy} onClick={() => act('sent')}>Mark Sent</Button>
        )}
        {contract.status === 'sent' && (
          <Button variant="primary" size="sm" loading={busy} onClick={onClick}>Sign</Button>
        )}
      </div>
    </div>
  )
}

/* ── Create contract modal ───────────────────────────────── */

function CreateContractModal({ templates, onClose, onSubmit }: {
  templates: ContractTemplate[]
  onClose: () => void
  onSubmit: (title: string, body: string, templateId: string | null) => Promise<void>
}) {
  const [title, setTitle]         = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [body, setBody]           = useState(templates[0]?.body ?? '')
  const [busy, setBusy]           = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  function onTemplateChange(id: string) {
    setTemplateId(id)
    const t = templates.find(t => t.id === id)
    if (t) setBody(t.body ?? '')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!title.trim()) return
    setBusy(true); setErr(null)
    try { await onSubmit(title.trim(), body, templateId || null) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to create'); setBusy(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Contract"
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-contract-form" loading={busy}>Create</Button>
        </>
      }
    >
      <form id="new-contract-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Contract title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required placeholder="e.g. Social Media Retainer Agreement" />
        {templates.length > 0 && (
          <Select
            label="Template"
            value={templateId}
            onChange={e => onTemplateChange(e.target.value)}
            options={[{ value: '', label: 'No template (blank)' }, ...templates.map(t => ({ value: t.id, label: t.name }))]}
          />
        )}
        <Textarea label="Contract body" value={body} onChange={e => setBody(e.target.value)} rows={8} />
        {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
      </form>
    </Modal>
  )
}

/* ── Contract detail / sign modal ────────────────────────── */

function ContractDetailModal({ contract, ctx, onStatus, onChanged, onClose }: {
  contract: Contract
  ctx: { agencyId: string; actorId: string }
  onStatus: (s: ContractStatus) => Promise<void>
  onChanged: () => Promise<void>
  onClose: () => void
}) {
  const [signatures, setSignatures] = useState<ContractSignature[]>([])
  const [showSign, setShowSign]     = useState(false)
  const [sigName, setSigName]       = useState('')
  const [sigEmail, setSigEmail]     = useState('')
  const [busy, setBusy]             = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  useEffect(() => {
    CT.listSignatures(contract.id).then(setSignatures).catch(() => {})
  }, [contract.id])

  async function handleSign(e: React.FormEvent) {
    e.preventDefault(); if (!sigName.trim()) return
    setBusy(true); setErr(null)
    try {
      await CT.signContract(contract, sigName.trim(), sigEmail.trim(), false, ctx)
      await onChanged()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to sign')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contract.title}
      subtitle={STATUS_LABEL[contract.status]}
      width={640}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {contract.body && (
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, maxHeight: 320, overflowY: 'auto' }}>
            <pre style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', margin: 0 }}>
              {contract.body}
            </pre>
          </div>
        )}

        {signatures.length > 0 && (
          <div>
            <p style={SL}>Signatures</p>
            {signatures.map(sig => (
              <div key={sig.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{sig.signer_name}</p>
                  {sig.signer_email && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{sig.signer_email}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge variant={sig.is_client ? 'info' : 'default'}>{sig.is_client ? 'Client' : 'Agency'}</Badge>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{new Date(sig.signed_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {showSign && contract.status !== 'signed' ? (
          <form onSubmit={handleSign} style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--hairline-2)', paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Sign this contract</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Full name" value={sigName} onChange={e => setSigName(e.target.value)} required autoFocus />
              <Input label="Email (optional)" type="email" value={sigEmail} onChange={e => setSigEmail(e.target.value)} />
            </div>
            {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" size="sm" type="submit" loading={busy}>Sign</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSign(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
            {contract.status === 'draft' && (
              <Button variant="primary" size="sm" loading={busy} onClick={async () => { setBusy(true); try { await onStatus('sent'); onClose() } finally { setBusy(false) } }}>Mark Sent</Button>
            )}
            {contract.status === 'sent' && (
              <Button variant="primary" size="sm" onClick={() => setShowSign(true)}>Sign Contract</Button>
            )}
            {contract.status !== 'signed' && contract.status !== 'archived' && (
              <Button variant="ghost" size="sm" loading={busy} onClick={async () => { setBusy(true); try { await onStatus('archived'); onClose() } finally { setBusy(false) } }}>Archive</Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */

const SL: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10,
}

function Skel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ height: 72, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.5 }} />
      ))}
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{description}</p>
      {action}
    </div>
  )
}
