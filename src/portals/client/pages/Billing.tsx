import { useEffect, useState } from 'react'
import { listClientInvoices, INVOICE_STATUS_BADGE } from '@/features/billing/api'
import { money } from '@/features/operations/helpers'
import { relativeTime } from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import type { Invoice } from '@/types'

export function ClientBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { listClientInvoices().then(d => { setInvoices(d); setLoading(false) }) }, [])

  const balance = invoices.reduce((n, i) => n + Math.max(i.total_cents - i.amount_paid_cents, 0), 0)

  if (loading) return <div className="animate-fade-up"><div style={{ height: 240, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Invoices</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your invoices and payment status.</p>
      </div>

      <div style={{ background: '#0B0913', borderRadius: 'var(--radius)', padding: 20, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .35, filter: 'blur(60px)', top: -80, right: -30 }} />
        <p style={{ position: 'relative', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Outstanding Balance</p>
        <p style={{ position: 'relative', fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>{money(balance)}</p>
      </div>

      {invoices.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '44px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>No invoices yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invoices.map(i => (
            <div key={i.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
              <div><p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{i.number}{i.title ? ` · ${i.title}` : ''}</p><p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{money(i.total_cents)} · {i.due_date ? `due ${new Date(i.due_date).toLocaleDateString()}` : relativeTime(i.created_at)}</p></div>
              <Badge variant={INVOICE_STATUS_BADGE[i.status]}>{i.status.replace('_', ' ')}</Badge>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, textAlign: 'center' }}>Online payment is coming soon — contact your team to settle invoices.</p>
    </div>
  )
}
