import { useState, useEffect, useCallback } from 'react'
import * as PR from '@/features/proposals/api'
import { useServices, usePackages } from '@/features/operations/hooks'
import { money } from '@/features/operations/helpers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Client, Proposal, ProposalSection, ProposalLineItem, ProposalStatus } from '@/types'

const STATUS_BADGE: Record<ProposalStatus, 'default' | 'info' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', sent: 'brand', viewed: 'info', accepted: 'success',
  declined: 'danger', expired: 'warning', archived: 'default',
}
const STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft', sent: 'Sent', viewed: 'Viewed', accepted: 'Accepted',
  declined: 'Declined', expired: 'Expired', archived: 'Archived',
}

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function ProposalsSection({ client, ctx, onChanged }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [openId, setOpenId]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setProposals(await PR.listProposalsByClient(client.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load proposals')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  async function handleCreate(title: string) {
    const p = await PR.createProposal({ title, client_id: client.id }, ctx)
    await load()
    setOpenId(p.id)
    setShowCreate(false)
    onChanged()
  }

  async function handleStatusChange(p: Proposal, status: ProposalStatus) {
    await PR.setProposalStatus(p, status, ctx)
    await load()
    onChanged()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Proposals</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Create, send, and track proposals for {client.business_name}.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New Proposal</Button>
      </div>

      {loading && <Skel />}

      {!loading && error && (
        <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && proposals.length === 0 && (
        <EmptyState
          title="No proposals yet"
          description="Create a proposal to outline scope, pricing, and terms for this client."
          action={<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>Create first proposal</Button>}
        />
      )}

      {!loading && !error && proposals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {proposals.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onClick={() => setOpenId(p.id)}
              onStatus={status => handleStatusChange(p, status)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProposalModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {openId && (
        <ProposalBuilderModal
          id={openId}
          ctx={ctx}
          onChanged={load}
          onClose={() => { setOpenId(null); onChanged() }}
        />
      )}
    </div>
  )
}

/* ── Proposal card ───────────────────────────────────────── */

function ProposalCard({ proposal, onClick, onStatus }: {
  proposal: Proposal
  onClick: () => void
  onStatus: (s: ProposalStatus) => void
}) {
  const [busy, setBusy] = useState(false)
  async function act(s: ProposalStatus) {
    setBusy(true); try { await onStatus(s) } finally { setBusy(false) }
  }
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={onClick}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{proposal.title}</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {money(proposal.total_cents)} · v{proposal.version}
            {proposal.expires_at && <> · Expires {new Date(proposal.expires_at).toLocaleDateString()}</>}
            {proposal.sent_at && <> · Sent {new Date(proposal.sent_at).toLocaleDateString()}</>}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[proposal.status]}>{STATUS_LABEL[proposal.status]}</Badge>
      </div>
      {proposal.status === 'draft' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)' }}>
          <Button variant="outline" size="sm" onClick={onClick}>Edit</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => act('sent')}>Mark Sent</Button>
        </div>
      )}
      {(proposal.status === 'sent' || proposal.status === 'viewed') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)' }}>
          <Button variant="primary" size="sm" loading={busy} onClick={() => act('accepted')}>Mark Accepted</Button>
          <Button variant="ghost" size="sm" loading={busy} onClick={() => act('declined')}>Declined</Button>
          <Button variant="outline" size="sm" onClick={onClick}>View</Button>
        </div>
      )}
      {(proposal.status === 'accepted' || proposal.status === 'declined' || proposal.status === 'expired' || proposal.status === 'archived') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)' }}>
          <Button variant="outline" size="sm" onClick={onClick}>View</Button>
        </div>
      )}
    </div>
  )
}

/* ── Create proposal modal ───────────────────────────────── */

function CreateProposalModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!title.trim()) return
    setBusy(true); setErr(null)
    try { await onSubmit(title.trim()) } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to create'); setBusy(false) }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="New Proposal"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-prop-form" loading={busy}>Create</Button>
        </>
      }
    >
      <form id="new-prop-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Proposal title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required placeholder="e.g. Social Media Management — Q3" />
        {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
      </form>
    </Modal>
  )
}

/* ── Proposal builder modal ──────────────────────────────── */

function ProposalBuilderModal({ id, ctx, onChanged, onClose }: {
  id: string
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onClose: () => void
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [sections, setSections] = useState<ProposalSection[]>([])
  const [items, setItems]       = useState<ProposalLineItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [pick, setPick]         = useState('')
  const [busy, setBusy]         = useState(false)
  const { services } = useServices()
  const { packages } = usePackages()

  const load = useCallback(async () => {
    const r = await PR.getProposal(id)
    setProposal(r.proposal); setSections(r.sections); setItems(r.items)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function addLine() {
    if (!pick) return
    const [kind, pid] = pick.split(':')
    if (kind === 'service') { const s = services.find(x => x.id === pid); if (s) await PR.addServiceLine(id, s, ctx) }
    if (kind === 'package') { const p = packages.find(x => x.id === pid); if (p) await PR.addPackageLine(id, p, ctx) }
    setPick(''); await load(); onChanged()
  }

  async function removeLine(item: ProposalLineItem) {
    await PR.removeLine(item); await load(); onChanged()
  }

  async function changeStatus(status: ProposalStatus) {
    if (!proposal) return
    setBusy(true)
    try { await PR.setProposalStatus(proposal, status, ctx); await load(); onChanged() }
    finally { setBusy(false) }
  }

  async function saveVer() {
    if (!proposal) return; await PR.saveVersion(proposal, ctx); await load()
  }

  if (loading) {
    return (
      <Modal open onClose={onClose} title="Proposal" width={700}>
        <div style={{ height: 240 }} />
      </Modal>
    )
  }

  if (!proposal) {
    return (
      <Modal open onClose={onClose} title="Proposal" width={700}>
        <p style={{ color: 'var(--danger)', fontSize: 13.5 }}>Could not load proposal.</p>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={proposal.title}
      subtitle={`${money(proposal.total_cents)} · ${STATUS_LABEL[proposal.status]}`}
      width={700}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Line items */}
        <div>
          <p style={SL}>Pricing</p>
          {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>No line items yet.</p>}
          {items.map(it => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--hairline-2)' }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                {it.name}
                <span style={{ color: 'var(--muted)', fontSize: 11.5, marginLeft: 6 }}>· {it.billing_kind}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{money(it.unit_price_cents)}</span>
                <button
                  onClick={() => removeLine(it)}
                  aria-label="Remove line item"
                  style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Select
                label=""
                value={pick}
                onChange={e => setPick(e.target.value)}
                options={[
                  { value: '', label: 'Add service or package…' },
                  ...services.filter(s => s.is_active).map(s => ({ value: `service:${s.id}`, label: `${s.name} (${money(s.price_cents)})` })),
                  ...packages.filter(p => p.is_active).map(p => ({ value: `package:${p.id}`, label: `${p.name} (${money(p.price_cents)})` })),
                ]}
              />
            </div>
            <Button variant="outline" size="sm" onClick={addLine} disabled={!pick}>Add</Button>
          </div>
          {items.length > 0 && (
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', marginTop: 10 }}>
              Total: {money(proposal.total_cents)}
            </p>
          )}
        </div>

        {/* Sections */}
        {sections.length > 0 && (
          <div>
            <p style={SL}>Content Sections</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sections.map(s => (
                <Textarea
                  key={s.id}
                  label={s.title}
                  defaultValue={s.body ?? ''}
                  rows={2}
                  onBlur={e => PR.updateSection(s.id, e.target.value)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
          {proposal.status === 'draft' && (
            <Button variant="primary" size="sm" loading={busy} onClick={() => changeStatus('sent')}>Mark Sent</Button>
          )}
          {(proposal.status === 'sent' || proposal.status === 'viewed') && (
            <>
              <Button variant="primary" size="sm" loading={busy} onClick={() => changeStatus('accepted')}>Mark Accepted</Button>
              <Button variant="ghost" size="sm" loading={busy} onClick={() => changeStatus('declined')}>Mark Declined</Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={saveVer}>Save Version</Button>
        </div>
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
