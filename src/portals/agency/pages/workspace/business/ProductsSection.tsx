import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ChipList } from '@/components/ui/ChipList'
import { DrawerPanel, DrawerFooter } from '@/components/ui/DrawerPanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { createProduct, updateProduct, deleteProduct, type ProductFormValues } from '@/features/products/api'
import { useProducts } from '@/features/products/hooks'
import type { Client, ClientProductService, ProductType, PricingType, ProductStatus } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'service',      label: 'Service' },
  { value: 'product',      label: 'Product' },
  { value: 'package',      label: 'Package' },
  { value: 'membership',   label: 'Membership' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'course',       label: 'Course' },
  { value: 'program',      label: 'Program' },
]

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: 'fixed',       label: 'Fixed price' },
  { value: 'range',       label: 'Price range' },
  { value: 'starting_at', label: 'Starting at' },
  { value: 'custom',      label: 'Custom / contact for pricing' },
  { value: 'free',        label: 'Free' },
]

const STATUS_OPTIONS: { value: ProductStatus; label: string; color: string }[] = [
  { value: 'active',        label: 'Active',        color: '#059669' },
  { value: 'inactive',      label: 'Inactive',      color: 'var(--muted)' },
  { value: 'seasonal',      label: 'Seasonal',      color: '#d97706' },
  { value: 'discontinued',  label: 'Discontinued',  color: 'var(--danger)' },
]

const EMPTY_FORM: ProductFormValues = {
  name: '', type: 'service', description: '', target_audience: '', benefits: [],
  pricing_type: 'fixed', price_cents: null, price_min_cents: null, price_max_cents: null,
  price_label: '', status: 'active', seasonal_availability: '', include_in_ai_context: true,
}

function formatPrice(p: ClientProductService): string {
  if (p.price_label) return p.price_label
  if (p.pricing_type === 'free') return 'Free'
  if (p.pricing_type === 'custom') return 'Contact for pricing'
  const fmt = (c: number | null) => c !== null ? `$${(c / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : ''
  if (p.pricing_type === 'range' && p.price_min_cents !== null && p.price_max_cents !== null)
    return `${fmt(p.price_min_cents)} – ${fmt(p.price_max_cents)}`
  if (p.pricing_type === 'starting_at' && p.price_min_cents !== null)
    return `Starting at ${fmt(p.price_min_cents)}`
  if (p.price_cents !== null) return fmt(p.price_cents)
  return '—'
}

export function ProductsSection({ client, ctx, onChanged }: Props) {
  const { products, loading, error, refresh } = useProducts(client.id)

  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [editing, setEditing]             = useState<ClientProductService | null>(null)
  const [form, setForm]                   = useState<ProductFormValues>(EMPTY_FORM)
  const [drawerError, setDrawerError]     = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [deletingItem, setDeletingItem]   = useState<ClientProductService | null>(null)
  const [deleting, setDeleting]           = useState(false)

  const [typeFilter, setTypeFilter] = useState<ProductType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all')

  function openAdd() {
    setEditing(null); setForm({ ...EMPTY_FORM }); setDrawerError(null); setDrawerOpen(true)
  }
  function openEdit(p: ClientProductService) {
    setEditing(p)
    setForm({
      name: p.name, type: p.type, description: p.description ?? '',
      target_audience: p.target_audience ?? '', benefits: p.benefits ?? [],
      pricing_type: p.pricing_type, price_cents: p.price_cents,
      price_min_cents: p.price_min_cents, price_max_cents: p.price_max_cents,
      price_label: p.price_label ?? '', status: p.status,
      seasonal_availability: p.seasonal_availability ?? '',
      include_in_ai_context: p.include_in_ai_context,
    })
    setDrawerError(null); setDrawerOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setDrawerError('Name is required'); return }
    setSaving(true); setDrawerError(null)
    try {
      if (editing) {
        await updateProduct(editing.id, client.id, form, ctx)
      } else {
        await createProduct(client.id, form, ctx)
      }
      setDrawerOpen(false); refresh(); onChanged()
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!deletingItem) return
    setDeleting(true)
    try {
      await deleteProduct(deletingItem.id, client.id, ctx)
      setDeletingItem(null); refresh(); onChanged()
    } catch { /* ignored — ConfirmDialog stays open */ }
    finally { setDeleting(false) }
  }

  const filtered = products.filter(p =>
    (typeFilter === 'all' || p.type === typeFilter) &&
    (statusFilter === 'all' || p.status === statusFilter),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Type filter */}
          <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All Types</FilterChip>
          {PRODUCT_TYPES.map(t => (
            <FilterChip key={t.value} active={typeFilter === t.value} onClick={() => setTypeFilter(t.value)}>{t.label}</FilterChip>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={openAdd}>+ Add</Button>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8 }}>
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All Statuses</FilterChip>
        {STATUS_OPTIONS.map(s => (
          <FilterChip key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value as ProductStatus | 'all')}>{s.label}</FilterChip>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>
            {products.length === 0 ? 'No products or services added yet.' : 'No results match the current filters.'}
          </p>
          {products.length === 0 && <Button variant="primary" size="sm" onClick={openAdd}>Add first offering</Button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeletingItem(p)}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      <DrawerPanel
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Offering' : 'Add Product or Service'}
        width={520}
        footer={
          <DrawerFooter
            onCancel={() => setDrawerOpen(false)}
            onConfirm={save}
            loading={saving}
            error={drawerError}
            confirmLabel={editing ? 'Save Changes' : 'Add Offering'}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Social Media Management" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField label="Type" value={form.type} onChange={v => setForm(f => ({ ...f, type: v as ProductType }))}>
              {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </SelectField>
            <SelectField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v as ProductStatus }))}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
          </div>

          <Textarea label="Description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this offering include?" />
          <Textarea label="Target Audience" rows={2} value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))} placeholder="Who is this for?" />

          <div>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Benefits (press Enter to add)</p>
            <ChipList values={form.benefits} onChange={v => setForm(f => ({ ...f, benefits: v }))} placeholder="Add benefit…" />
          </div>

          <SelectField label="Pricing Type" value={form.pricing_type} onChange={v => setForm(f => ({ ...f, pricing_type: v as PricingType }))}>
            {PRICING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectField>

          {form.pricing_type === 'fixed' && (
            <Input label="Price (USD)" type="number" value={form.price_cents !== null ? (form.price_cents / 100).toString() : ''} onChange={e => setForm(f => ({ ...f, price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))} placeholder="0.00" />
          )}
          {form.pricing_type === 'range' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Min Price (USD)" type="number" value={form.price_min_cents !== null ? (form.price_min_cents / 100).toString() : ''} onChange={e => setForm(f => ({ ...f, price_min_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))} placeholder="0.00" />
              <Input label="Max Price (USD)" type="number" value={form.price_max_cents !== null ? (form.price_max_cents / 100).toString() : ''} onChange={e => setForm(f => ({ ...f, price_max_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))} placeholder="0.00" />
            </div>
          )}
          {form.pricing_type === 'starting_at' && (
            <Input label="Starting Price (USD)" type="number" value={form.price_min_cents !== null ? (form.price_min_cents / 100).toString() : ''} onChange={e => setForm(f => ({ ...f, price_min_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))} placeholder="0.00" />
          )}
          {(form.pricing_type === 'fixed' || form.pricing_type === 'starting_at' || form.pricing_type === 'range') && (
            <Input label="Price Label (overrides calculated display)" value={form.price_label} onChange={e => setForm(f => ({ ...f, price_label: e.target.value }))} placeholder="e.g. Starting at $2,500/mo — leave blank to auto-format" />
          )}

          {form.status === 'seasonal' && (
            <Textarea label="Seasonal Availability" rows={2} value={form.seasonal_availability} onChange={e => setForm(f => ({ ...f, seasonal_availability: e.target.value }))} placeholder="e.g. Available May–August" />
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
            <input
              type="checkbox"
              checked={form.include_in_ai_context}
              onChange={e => setForm(f => ({ ...f, include_in_ai_context: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            Include in AI context for this client
          </label>
        </div>
      </DrawerPanel>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingItem}
        title="Delete Offering"
        description={`Delete "${deletingItem?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  )
}

/* ── Shared UI ───────────────────────────────────────────── */

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: active ? 600 : 400,
        border: active ? '1.5px solid var(--violet)' : '1px solid var(--hairline)',
        background: active ? 'var(--lavender-soft)' : 'var(--surface-solid)',
        color: active ? 'var(--violet)' : 'var(--ink-2)',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </button>
  )
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', fontSize: 13, padding: '9px 10px', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-solid)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
      >
        {children}
      </select>
    </div>
  )
}

function ProductCard({ product, onEdit, onDelete }: {
  product: ClientProductService; onEdit: () => void; onDelete: () => void
}) {
  const st = STATUS_OPTIONS.find(s => s.value === product.status)
  const tp = PRODUCT_TYPES.find(t => t.value === product.type)

  return (
    <div style={{
      background: 'var(--surface-solid)',
      border: '1px solid var(--hairline)',
      borderRadius: 'var(--radius-sm)',
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{product.name}</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'var(--bg)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>
            {tp?.label}
          </span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, color: st?.color ?? 'var(--muted)' }}>
            {st?.label}
          </span>
        </div>
        {product.description && (
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 6 }}>{product.description}</p>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--violet)', fontWeight: 600 }}>{formatPrice(product)}</p>
        {product.benefits.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {product.benefits.map((b, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 9999, background: 'var(--lavender-soft)', color: 'var(--violet)', border: '1px solid rgba(109,61,230,0.15)' }}>{b}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', borderRadius: 4, fontSize: 13 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
