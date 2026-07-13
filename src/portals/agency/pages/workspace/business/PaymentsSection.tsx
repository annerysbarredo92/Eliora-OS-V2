import { useState, useEffect, useCallback } from 'react'
import { listPaymentsByClient, listInvoices, recordPayment } from '@/features/billing/api'
import { money, toCents } from '@/features/operations/helpers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { Client, Payment, Invoice, InvoiceStatus, PaymentMethod } from '@/types'

const METHOD_LABEL: Record<string, string> = {
  manual:        'Manual',
  bank_transfer: 'Bank transfer',
  ach:           'ACH',
  credit_card:   'Credit card',
}

const INVOICE_STATUS_BADGE: Partial<Record<InvoiceStatus, 'default' | 'brand' | 'warning' | 'danger' | 'success'>> = {
  sent: 'brand', viewed: 'brand', partially_paid: 'warning', overdue: 'danger', paid: 'success',
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'manual',        label: 'Manual recording' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'ach',           label: 'ACH' },
  { value: 'credit_card',   label: 'Credit card' },
]

const OPEN_STATUSES: InvoiceStatus[] = ['sent', 'viewed', 'partially_paid', 'overdue']

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function PaymentsSection({ client, ctx, onChanged }: Props) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [payTarget, setPayTarget] = useState<Invoice | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, i] = await Promise.all([
        listPaymentsByClient(client.id),
        listInvoices(client.id),
      ])
      setPayments(p); setInvoices(i)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i]))
  const openInvoices = invoices.filter(i => (OPEN_STATUSES as string[]).includes(i.status))

  const totalCollected    = payments.reduce((sum, p) => sum + p.amount_cents, 0)
  const totalOutstanding  = openInvoices.reduce((sum, i) => sum + Math.max(i.total_cents - i.amount_paid_cents, 0), 0)
  const lastPayment       = payments[0] ?? null

  const now = new Date()
  const thisMonthCollected = payments
    .filter(p => { const d = new Date(p.recorded_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    .reduce((sum, p) => sum + p.amount_cents, 0)

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Payments</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>All payments recorded for {client.business_name}.</p>
      </div>

      {/* ── Record Payment entry point ─────────────────────── */}
      {!loading && !error && openInvoices.length > 0 && (
        <div style={{
          background: 'color-mix(in srgb, var(--violet) 6%, var(--surface-solid))',
          border: '1px solid color-mix(in srgb, var(--violet) 20%, var(--hairline))',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              {openInvoices.length} invoice{openInvoices.length !== 1 ? 's' : ''} awaiting payment
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{money(totalOutstanding)} outstanding</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {openInvoices.slice(0, 3).map(inv => (
              <Button key={inv.id} variant="outline" size="sm" onClick={() => setPayTarget(inv)}>
                {inv.title ?? inv.number ?? 'Invoice'}
              </Button>
            ))}
            {openInvoices.length > 3 && (
              <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
                +{openInvoices.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Summary metrics ───────────────────────────────── */}
      {!loading && !error && (payments.length > 0 || invoices.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
          <MetricCard label="Total Collected" value={money(totalCollected)} color="var(--success)" />
          <MetricCard label="This Month" value={money(thisMonthCollected)} />
          <MetricCard label="Outstanding" value={money(totalOutstanding)} color={totalOutstanding > 0 ? 'var(--warning)' : undefined} />
          <MetricCard label="Payments" value={String(payments.length)} />
          {lastPayment && (
            <MetricCard label="Last Payment" value={money(lastPayment.amount_cents)} sub={new Date(lastPayment.recorded_at).toLocaleDateString()} />
          )}
        </div>
      )}

      {loading && <Skel />}

      {!loading && error && (
        <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em' }}>No payments recorded</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {openInvoices.length > 0
              ? 'Select an invoice above to record a payment.'
              : 'Payments appear here once recorded against an invoice.'}
          </p>
        </div>
      )}

      {!loading && !error && payments.length > 0 && (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {['Amount', 'Invoice', 'Method', 'Date'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', fontWeight: 700, borderBottom: '1px solid var(--hairline-2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const inv = p.invoice_id ? invoiceMap[p.invoice_id] : null
                  return (
                    <tr key={p.id}>
                      <td style={CELL}>
                        <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>{money(p.amount_cents)}</span>
                      </td>
                      <td style={CELL}>
                        {inv ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--ink-2)' }}>{inv.title ?? inv.number ?? 'Invoice'}</span>
                            {inv.status && INVOICE_STATUS_BADGE[inv.status as InvoiceStatus] && (
                              <Badge variant={INVOICE_STATUS_BADGE[inv.status as InvoiceStatus]!} style={{ fontSize: 10 }}>
                                {inv.status}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                        {p.note && <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{p.note}</p>}
                      </td>
                      <td style={CELL}>
                        <span style={{ color: 'var(--ink-2)' }}>{METHOD_LABEL[p.method] ?? p.method}</span>
                      </td>
                      <td style={CELL}>
                        <span style={{ color: 'var(--muted)' }}>{new Date(p.recorded_at).toLocaleDateString()}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payTarget && (
        <RecordPaymentModal
          invoice={payTarget}
          ctx={ctx}
          onClose={() => setPayTarget(null)}
          onRecorded={async () => { setPayTarget(null); await load(); onChanged() }}
        />
      )}
    </div>
  )
}

/* ── Inline Record Payment modal ───────────────────────────── */

function RecordPaymentModal({ invoice, ctx, onClose, onRecorded }: {
  invoice: Invoice
  ctx: { agencyId: string; actorId: string }
  onClose: () => void
  onRecorded: () => Promise<void>
}) {
  const [amountStr, setAmountStr] = useState('')
  const [method, setMethod]       = useState<PaymentMethod>('manual')
  const [busy, setBusy]           = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  const outstanding = invoice.total_cents - invoice.amount_paid_cents

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = toCents(amountStr)
    if (cents <= 0)          { setErr('Enter a valid amount'); return }
    if (cents > outstanding) { setErr(`Amount exceeds outstanding balance of ${money(outstanding)}`); return }
    setBusy(true); setErr(null)
    try {
      await recordPayment(invoice, cents, method, ctx)
      await onRecorded()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to record payment')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Payment"
      subtitle={`${invoice.title ?? invoice.number ?? 'Invoice'} · ${money(outstanding)} outstanding`}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="pay-form-ps" loading={busy}>Record Payment</Button>
        </>
      }
    >
      <form id="pay-form-ps" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Amount (USD)"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            inputMode="decimal"
            required
            autoFocus
            hint={amountStr ? money(toCents(amountStr)) : ''}
            placeholder={`Up to ${money(outstanding)}`}
          />
          <Select
            label="Method"
            value={method}
            onChange={e => setMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS}
          />
        </div>
        {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
      </form>
    </Modal>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */

const CELL: React.CSSProperties = {
  padding: '11px 16px',
  borderBottom: '1px solid var(--hairline-2)',
  verticalAlign: 'middle',
}

function MetricCard({ label, value, color = 'var(--ink)', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function Skel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ height: 44, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.5 }} />
      ))}
    </div>
  )
}
