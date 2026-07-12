import { useState, useEffect, useCallback } from 'react'
import { listPaymentsByClient, listInvoices } from '@/features/billing/api'
import { money } from '@/features/operations/helpers'
import type { Client, Payment, Invoice } from '@/types'

const METHOD_LABEL: Record<string, string> = {
  manual:        'Manual',
  bank_transfer: 'Bank transfer',
  ach:           'ACH',
  credit_card:   'Credit card',
}

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function PaymentsSection({ client, ctx: _ctx, onChanged: _onChanged }: Props) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

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

  const totalCollected = payments.reduce((sum, p) => sum + p.amount_cents, 0)

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Payments</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>All payments recorded for {client.business_name}.</p>
      </div>

      {!loading && !error && payments.length > 0 && (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 32 }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Total Collected</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{money(totalCollected)}</p>
          </div>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Payments</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{payments.length}</p>
          </div>
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
            Payments appear here when recorded against an invoice. Go to the Invoices section to record a payment.
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
                        {inv
                          ? <span style={{ color: 'var(--ink-2)' }}>{inv.title ?? inv.number ?? 'Invoice'}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
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
    </div>
  )
}

const CELL: React.CSSProperties = {
  padding: '11px 16px',
  borderBottom: '1px solid var(--hairline-2)',
  verticalAlign: 'middle',
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
