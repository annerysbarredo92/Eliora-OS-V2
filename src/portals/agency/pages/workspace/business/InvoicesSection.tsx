import { useState, useEffect, useCallback } from 'react'
import * as B from '@/features/billing/api'
import { money, toCents } from '@/features/operations/helpers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Client, Invoice, InvoiceStatus, InvoiceItem, Payment, PaymentMethod } from '@/types'

const STATUS_BADGE: Record<InvoiceStatus, 'default' | 'info' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', sent: 'brand', viewed: 'info', partially_paid: 'warning',
  paid: 'success', overdue: 'danger', void: 'default', archived: 'default',
}
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft', sent: 'Sent', viewed: 'Viewed', partially_paid: 'Partial',
  paid: 'Paid', overdue: 'Overdue', void: 'Void', archived: 'Archived',
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'manual', label: 'Manual recording' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'ach', label: 'ACH' },
  { value: 'credit_card', label: 'Credit card' },
]

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function InvoicesSection({ client, ctx, onChanged }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [openId, setOpenId]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setInvoices(await B.listInvoices(client.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  async function handleCreate(values: B.InvoiceFormValues) {
    await B.createInvoice(values, ctx)
    await load()
    setShowCreate(false)
    onChanged()
  }

  async function handleStatus(inv: Invoice, status: InvoiceStatus) {
    await B.setInvoiceStatus(inv, status, ctx)
    await load()
    onChanged()
  }

  const metrics = B.computeBillingMetrics(invoices)
  const openInvoice = invoices.find(i => i.id === openId) ?? null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Invoices</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Billing and payment tracking for {client.business_name}.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New Invoice</Button>
      </div>

      {!loading && !error && invoices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Collected', value: money(metrics.collected), color: 'var(--success)' },
            { label: 'Outstanding', value: money(metrics.outstanding), color: 'var(--gold)' },
            { label: 'Overdue', value: money(metrics.overdue), color: metrics.overdue > 0 ? 'var(--danger)' : 'var(--muted)' },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <Skel />}

      {!loading && error && (
        <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <EmptyState
          title="No invoices yet"
          description="Create an invoice to bill this client and track payments."
          action={<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>Create first invoice</Button>}
        />
      )}

      {!loading && !error && invoices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invoices.map(inv => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              onClick={() => setOpenId(inv.id)}
              onStatus={status => handleStatus(inv, status)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateInvoiceModal
          clientId={client.id}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {openId && openInvoice && (
        <InvoiceDetailModal
          invoice={openInvoice}
          ctx={ctx}
          onStatus={status => handleStatus(openInvoice, status)}
          onChanged={async () => { await load(); onChanged() }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

/* ── Invoice card ────────────────────────────────────────── */

function InvoiceCard({ invoice, onClick, onStatus }: {
  invoice: Invoice
  onClick: () => void
  onStatus: (s: InvoiceStatus) => void
}) {
  const [busy, setBusy] = useState(false)
  const outstanding = invoice.total_cents - invoice.amount_paid_cents

  async function act(s: InvoiceStatus) {
    setBusy(true); try { await onStatus(s) } finally { setBusy(false) }
  }

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={onClick}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {invoice.title ?? invoice.number ?? 'Invoice'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {invoice.number && <>{invoice.number} · </>}
            {money(invoice.total_cents)}
            {invoice.amount_paid_cents > 0 && invoice.amount_paid_cents < invoice.total_cents &&
              <> · {money(outstanding)} owed</>}
            {invoice.due_date && <> · Due {new Date(invoice.due_date).toLocaleDateString()}</>}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)' }}>
        <Button variant="outline" size="sm" onClick={onClick}>
          {invoice.status === 'draft' ? 'Edit' : 'View'}
        </Button>
        {invoice.status === 'draft' && (
          <Button variant="primary" size="sm" loading={busy} onClick={() => act('sent')}>Mark Sent</Button>
        )}
        {(['sent', 'viewed', 'partially_paid', 'overdue'] as InvoiceStatus[]).includes(invoice.status) && (
          <Button variant="primary" size="sm" onClick={onClick}>Record Payment</Button>
        )}
      </div>
    </div>
  )
}

/* ── Create invoice modal ────────────────────────────────── */

function CreateInvoiceModal({ clientId, onClose, onSubmit }: {
  clientId: string
  onClose: () => void
  onSubmit: (values: B.InvoiceFormValues) => Promise<void>
}) {
  const [v, setV] = useState({ client_id: clientId, title: '', due_date: '', is_recurring: false, recurrence: 'monthly', notes: '' })
  const [amount, setAmount] = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = toCents(amount)
    if (cents <= 0) { setErr('Enter a valid amount'); return }
    setBusy(true); setErr(null)
    try { await onSubmit({ ...v, total_cents: cents }) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to create'); setBusy(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Invoice"
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-inv-form" loading={busy}>Create</Button>
        </>
      }
    >
      <form id="new-inv-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Title" value={v.title} onChange={e => setV(s => ({ ...s, title: e.target.value }))} autoFocus placeholder="e.g. January Retainer" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            label="Amount (USD)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="decimal"
            required
            hint={amount ? money(toCents(amount)) : ''}
          />
          <Input label="Due date" type="date" value={v.due_date} onChange={e => setV(s => ({ ...s, due_date: e.target.value }))} />
        </div>
        <Textarea label="Notes (optional)" value={v.notes} onChange={e => setV(s => ({ ...s, notes: e.target.value }))} rows={2} />
        {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
      </form>
    </Modal>
  )
}

/* ── Invoice detail modal ────────────────────────────────── */

function InvoiceDetailModal({ invoice, ctx, onStatus, onChanged, onClose }: {
  invoice: Invoice
  ctx: { agencyId: string; actorId: string }
  onStatus: (s: InvoiceStatus) => Promise<void>
  onChanged: () => Promise<void>
  onClose: () => void
}) {
  const [items, setItems]       = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)
  const [showPay, setShowPay]   = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('manual')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  useEffect(() => {
    B.getInvoice(invoice.id).then(r => {
      setItems(r.items); setPayments(r.payments); setLoading(false)
    }).catch(() => setLoading(false))
  }, [invoice.id])

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    const cents = toCents(payAmount)
    if (cents <= 0)        { setErr('Enter a valid amount'); return }
    if (cents > outstanding) { setErr(`Amount exceeds outstanding balance of ${money(outstanding)}`); return }
    setBusy(true); setErr(null)
    try {
      await B.recordPayment(invoice, cents, payMethod, ctx)
      await onChanged()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to record payment')
      setBusy(false)
    }
  }

  const outstanding = invoice.total_cents - invoice.amount_paid_cents
  const canPay = (['sent', 'viewed', 'partially_paid', 'overdue'] as InvoiceStatus[]).includes(invoice.status)

  return (
    <Modal
      open
      onClose={onClose}
      title={invoice.title ?? invoice.number ?? 'Invoice'}
      subtitle={`${money(invoice.total_cents)} · ${STATUS_LABEL[invoice.status]}`}
      width={600}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!loading && items.length > 0 && (
          <div>
            <p style={SL}>Line Items</p>
            {items.map(it => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
                <div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink)' }}>{it.name}</p>
                  {it.description && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{it.description}</p>}
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', flexShrink: 0, marginLeft: 12 }}>
                  {it.quantity > 1 ? `${it.quantity} × ` : ''}{money(it.unit_price_cents)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Total: {money(invoice.total_cents)}</span>
            </div>
          </div>
        )}

        <div>
          <p style={SL}>Payment Status</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Stat label="Total" value={money(invoice.total_cents)} />
            <Stat label="Paid" value={money(invoice.amount_paid_cents)} color="var(--success)" />
            {outstanding > 0 && <Stat label="Outstanding" value={money(outstanding)} color="var(--warning)" />}
          </div>
        </div>

        {!loading && payments.length > 0 && (
          <div>
            <p style={SL}>Payment History</p>
            {payments.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{money(p.amount_cents)}</p>
                  {p.note && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{p.note}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>{p.method.replace('_', ' ')}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{new Date(p.recorded_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {showPay && canPay ? (
          <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--hairline-2)', paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Record a payment</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Amount (USD)"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                inputMode="decimal"
                required
                autoFocus
                hint={payAmount ? money(toCents(payAmount)) : ''}
                placeholder={`Up to ${money(outstanding)}`}
              />
              <Select
                label="Method"
                value={payMethod}
                onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                options={PAYMENT_METHODS}
              />
            </div>
            {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" size="sm" type="submit" loading={busy}>Record Payment</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowPay(false); setErr(null) }}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
            {invoice.status === 'draft' && (
              <Button variant="primary" size="sm" loading={busy} onClick={async () => { setBusy(true); try { await onStatus('sent'); onClose() } finally { setBusy(false) } }}>Mark Sent</Button>
            )}
            {canPay && (
              <Button variant="primary" size="sm" onClick={() => setShowPay(true)}>Record Payment</Button>
            )}
            {invoice.status !== 'void' && invoice.status !== 'archived' && invoice.status !== 'paid' && (
              <Button variant="ghost" size="sm" loading={busy} onClick={async () => { setBusy(true); try { await onStatus('void'); onClose() } finally { setBusy(false) } }}>Void</Button>
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

function Stat({ label, value, color = 'var(--ink)' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color }}>{value}</p>
    </div>
  )
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
