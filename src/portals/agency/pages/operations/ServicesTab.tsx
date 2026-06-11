import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/Menu'
import { ServiceModal } from '@/features/operations/components/ServiceModal'
import { createService, updateService, setServiceActive } from '@/features/operations/api'
import { billingLabel, money } from '@/features/operations/helpers'
import type { Service } from '@/types'
import type { ServiceFormValues } from '@/features/operations/api'

interface ServicesTabProps {
  services: Service[]
  loading: boolean
  ctx: { agencyId: string; actorId: string }
  onChanged: () => Promise<void> | void
  openSignal: number
}

function toForm(s: Service): ServiceFormValues {
  return {
    name: s.name, category: s.category ?? 'Other', description: s.description ?? '',
    price_cents: s.price_cents, billing_type: s.billing_type, is_active: s.is_active,
  }
}

export function ServicesTab({ services, loading, ctx, onChanged, openSignal }: ServicesTabProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const lastSignal = useRef(openSignal)

  useEffect(() => {
    if (openSignal !== lastSignal.current) {
      lastSignal.current = openSignal
      setShowCreate(true)
    }
  }, [openSignal])

  async function handleCreate(v: ServiceFormValues) { await createService(v, ctx); await onChanged() }
  async function handleEdit(v: ServiceFormValues) { if (editTarget) { await updateService(editTarget.id, v, ctx); await onChanged() } }
  async function toggleActive(s: Service) { await setServiceActive(s, !s.is_active, ctx); await onChanged() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Define the services your agency offers. The first active service completes onboarding.</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Create service
        </Button>
      </div>

      {loading ? (
        <Skeleton />
      ) : services.length === 0 ? (
        <Empty label="No services yet" sub="Create your first service to start building packages." onAdd={() => setShowCreate(true)} addLabel="Create service" />
      ) : (
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {['Service', 'Category', 'Price', 'Billing', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', fontWeight: 700, borderBottom: '1px solid var(--hairline-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.6 }}>
                  <td style={cell}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.name}</span>{s.description && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{s.description}</span>}</td>
                  <td style={{ ...cell, color: 'var(--ink-2)' }}>{s.category || '—'}</td>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--ink)' }}>{money(s.price_cents)}</td>
                  <td style={{ ...cell, color: 'var(--ink-2)' }}>{billingLabel(s.billing_type)}</td>
                  <td style={cell}><Badge variant={s.is_active ? 'success' : 'default'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td style={cell}>
                    <ActionMenu items={[
                      { label: 'Edit', onClick: () => setEditTarget(s) },
                      { label: s.is_active ? 'Deactivate' : 'Activate', onClick: () => toggleActive(s), danger: s.is_active, dividerBefore: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ServiceModal open={showCreate} mode="create" onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      <ServiceModal open={!!editTarget} mode="edit" initial={editTarget ? toForm(editTarget) : undefined} onClose={() => setEditTarget(null)} onSubmit={handleEdit} />
    </div>
  )
}

const cell: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid var(--hairline-2)', verticalAlign: 'middle' }

export function Skeleton() {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ height: 40, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}
    </div>
  )
}

export function Empty({ label, sub, onAdd, addLabel }: { label: string; sub: string; onAdd: () => void; addLabel: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>{label}</p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.6 }}>{sub}</p>
      <Button variant="primary" size="sm" onClick={onAdd}>{addLabel}</Button>
    </div>
  )
}
