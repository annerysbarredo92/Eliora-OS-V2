import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import * as B from '@/features/billing/api'
import { money, toCents } from '@/features/operations/helpers'
import { KpiCard } from '@/components/ui/KpiCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ActiveToggle } from '@/features/operations/components/ServiceModal'
import type { Invoice, PaymentMethod } from '@/types'

export function AgencyBilling() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<Invoice | null>(null)

  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null
  const clientName = (id: string) => clients.find(c => c.id === id)?.business_name ?? '—'
  const load = useCallback(async () => { try { setInvoices(await B.listInvoices()) } catch { /* table maybe not applied */ } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  const m = B.computeBillingMetrics(invoices)

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Billing</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Invoices and payments. Payments are recorded manually.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} disabled={clients.length === 0}>New invoice</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KpiCard label="This Month" value={money(m.monthly)} accent="violet" />
        <KpiCard label="Collected" value={money(m.collected)} accent="success" />
        <KpiCard label="Outstanding" value={money(m.outstanding)} accent="gold" />
        <KpiCard label="Overdue" value={money(m.overdue)} accent="muted" />
      </div>

      {loading ? <Skel /> : invoices.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>No invoices yet</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>{clients.length === 0 ? 'Add a client first.' : 'Create your first invoice. (Run wave-03 SQL if this looks empty after adding one.)'}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {['Invoice', 'Client', 'Total', 'Paid', 'Status', 'Due', ''].map(h => <th key={h} style={{ padding: '11px 14px', fontWeight: 700, borderBottom: '1px solid var(--hairline-2)', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>{invoices.map(i => (
              <tr key={i.id} onClick={() => setDetail(i)} style={{ cursor: 'pointer' }}>
                <td style={cell}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{i.number}</span></td>
                <td style={{ ...cell, color: 'var(--ink-2)' }}>{clientName(i.client_id)}</td>
                <td style={{ ...cell, fontWeight: 600 }}>{money(i.total_cents)}</td>
                <td style={{ ...cell, color: 'var(--muted)' }}>{money(i.amount_paid_cents)}</td>
                <td style={cell}><Badge variant={B.INVOICE_STATUS_BADGE[i.status]}>{i.status.replace('_', ' ')}</Badge></td>
                <td style={{ ...cell, color: 'var(--muted)' }}>{i.due_date ? new Date(i.due_date).toLocaleDateString() : '—'}</td>
                <td style={cell}><span style={{ color: 'var(--violet)', fontWeight: 600, fontSize: 12.5 }}>Open ›</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {ctx && <CreateInvoice clients={clients} onClose={() => setShowCreate(false)} open={showCreate} onCreated={load} ctx={ctx} />}
      {ctx && detail && <InvoiceDetail invoice={detail} clientName={clientName(detail.client_id)} ctx={ctx} onChanged={load} onClose={() => setDetail(null)} />}
    </div>
  )
}

const cell: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid var(--hairline-2)', verticalAlign: 'middle' }
function Skel() { return <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 38, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div> }

function CreateInvoice({ open, clients, onClose, onCreated, ctx }: { open: boolean; clients: import('@/types').Client[]; onClose: () => void; onCreated: () => void; ctx: { agencyId: string; actorId: string } }) {
  const [v, setV] = useState({ client_id: '', title: '', due_date: '', is_recurring: false, recurrence: 'monthly', notes: '' })
  const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setV({ client_id: clients[0]?.id ?? '', title: '', due_date: '', is_recurring: false, recurrence: 'monthly', notes: '' }); setAmount('') } }, [open, clients])
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!v.client_id) return; setBusy(true); try { await B.createInvoice({ ...v, total_cents: toCents(amount) }, ctx); onCreated(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title="New invoice" width={520} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="inv-new" loading={busy}>Create</Button></>}>
      <form id="inv-new" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Select label="Client" value={v.client_id} onChange={e => setV(s => ({ ...s, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.business_name }))} />
        <Input label="Title" value={v.title} onChange={e => setV(s => ({ ...s, title: e.target.value }))} placeholder="January retainer" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Amount (USD)" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" hint={amount ? money(toCents(amount)) : ''} />
          <Input label="Due date" type="date" value={v.due_date} onChange={e => setV(s => ({ ...s, due_date: e.target.value }))} />
        </div>
        <ActiveToggle checked={v.is_recurring} onChange={val => setV(s => ({ ...s, is_recurring: val }))} label="Recurring (scheduling only — no auto-charge)" />
        <Textarea label="Notes" value={v.notes} onChange={e => setV(s => ({ ...s, notes: e.target.value }))} rows={2} />
      </form>
    </Modal>
  )
}

function InvoiceDetail({ invoice, clientName, ctx, onChanged, onClose }: { invoice: Invoice; clientName: string; ctx: { agencyId: string; actorId: string }; onChanged: () => void; onClose: () => void }) {
  const [payAmount, setPayAmount] = useState(''); const [method, setMethod] = useState<PaymentMethod>('manual'); const [busy, setBusy] = useState(false)
  async function pay() { setBusy(true); try { await B.recordPayment(invoice, toCents(payAmount), method, ctx); onChanged(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title={invoice.number ?? 'Invoice'} subtitle={`${clientName} · ${money(invoice.total_cents)}`} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Stat label="Total" value={money(invoice.total_cents)} /><Stat label="Paid" value={money(invoice.amount_paid_cents)} /><Stat label="Status" value={invoice.status.replace('_', ' ')} />
        </div>
        {invoice.notes && <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{invoice.notes}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {invoice.status === 'draft' && <Button variant="primary" size="sm" onClick={() => B.setInvoiceStatus(invoice, 'sent', ctx).then(onChanged).then(onClose)}>Mark sent</Button>}
          <Button variant="ghost" size="sm" onClick={() => B.setInvoiceStatus(invoice, 'void', ctx).then(onChanged).then(onClose)}>Void</Button>
        </div>
        <div style={{ borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>Record payment (manual)</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Input label="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} inputMode="decimal" /></div>
            <div style={{ width: 150 }}><Select label="Method" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} options={B.PAYMENT_METHODS} /></div>
            <Button variant="primary" size="sm" onClick={pay} loading={busy} disabled={!payAmount}>Record</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
function Stat({ label, value }: { label: string; value: string }) { return <div><p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>{label}</p><p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{value}</p></div> }
