import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/Menu'
import { PackageModal } from '@/features/operations/components/PackageModal'
import { createPackage, updatePackage, setPackageActive, setDefaultPackage } from '@/features/operations/api'
import { billingLabel, money } from '@/features/operations/helpers'
import { Skeleton, Empty } from './ServicesTab'
import type { Service, Package } from '@/types'
import type { PackageFormValues } from '@/features/operations/api'

interface PackagesTabProps {
  packages: Package[]
  services: Service[]
  loading: boolean
  ctx: { agencyId: string; actorId: string }
  onChanged: () => Promise<void> | void
  openSignal: number
}

function toForm(p: Package): PackageFormValues {
  return {
    name: p.name, description: p.description ?? '', price_cents: p.price_cents,
    billing_frequency: p.billing_frequency, is_active: p.is_active,
    service_ids: (p.package_services ?? []).map(ps => ps.service_id),
  }
}

export function PackagesTab({ packages, services, loading, ctx, onChanged, openSignal }: PackagesTabProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Package | null>(null)
  const lastSignal = useRef(openSignal)

  useEffect(() => {
    if (openSignal !== lastSignal.current) {
      lastSignal.current = openSignal
      setShowCreate(true)
    }
  }, [openSignal])

  const serviceName = (id: string) => services.find(s => s.id === id)?.name ?? 'Service'

  async function handleCreate(v: PackageFormValues) { await createPackage(v, ctx); await onChanged() }
  async function handleEdit(v: PackageFormValues) { if (editTarget) { await updatePackage(editTarget.id, v, ctx); await onChanged() } }
  async function toggleActive(p: Package) { await setPackageActive(p, !p.is_active, ctx); await onChanged() }
  async function makeDefault(p: Package) { await setDefaultPackage(p, ctx); await onChanged() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Bundle services into packages clients can buy. The first active package completes onboarding.</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Create package
        </Button>
      </div>

      {loading ? (
        <Skeleton />
      ) : packages.length === 0 ? (
        <Empty label="No packages yet" sub="Create a package to bundle your services for clients." onAdd={() => setShowCreate(true)} addLabel="Create package" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {packages.map(p => {
            const ids = (p.package_services ?? []).map(ps => ps.service_id)
            return (
              <div key={p.id} style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: `1px solid ${p.is_default ? 'var(--violet)' : 'var(--hairline)'}`, borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20, opacity: p.is_active ? 1 : 0.62, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</p>
                    {p.is_default && <Badge variant="brand">Default</Badge>}
                    {!p.is_active && <Badge variant="default">Inactive</Badge>}
                  </div>
                  <ActionMenu items={[
                    { label: 'Edit', onClick: () => setEditTarget(p) },
                    ...(!p.is_default && p.is_active ? [{ label: 'Set as default', onClick: () => makeDefault(p) }] : []),
                    { label: p.is_active ? 'Deactivate' : 'Activate', onClick: () => toggleActive(p), danger: p.is_active, dividerBefore: true },
                  ]} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{money(p.price_cents)}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>/ {billingLabel(p.billing_frequency).toLowerCase()}</span>
                </div>
                {p.description && <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 12 }}>{p.description}</p>}
                <div style={{ borderTop: '1px solid var(--hairline-2)', paddingTop: 12 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{ids.length} service{ids.length === 1 ? '' : 's'}</p>
                  {ids.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No services attached yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ids.map(id => (
                        <span key={id} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 999, background: 'var(--lavender-soft)', color: 'var(--violet)', fontWeight: 600 }}>{serviceName(id)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PackageModal open={showCreate} mode="create" services={services} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      <PackageModal open={!!editTarget} mode="edit" services={services} initial={editTarget ? toForm(editTarget) : undefined} onClose={() => setEditTarget(null)} onSubmit={handleEdit} />
    </div>
  )
}
