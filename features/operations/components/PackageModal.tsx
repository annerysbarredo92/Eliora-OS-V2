import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ActiveToggle, ErrBox } from './ServiceModal'
import { BILLING_FREQ_OPTIONS, money, toCents } from '../helpers'
import type { PackageFormValues } from '../api'
import type { Service } from '@/types'

const EMPTY: PackageFormValues = {
  name: '', description: '', price_cents: 0, billing_frequency: 'monthly', is_active: true, service_ids: [],
}

interface PackageModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: PackageFormValues
  services: Service[]
  onClose: () => void
  onSubmit: (values: PackageFormValues) => Promise<void>
}

export function PackageModal({ open, mode, initial, services, onClose, onSubmit }: PackageModalProps) {
  const [values, setValues] = useState<PackageFormValues>(initial ?? EMPTY)
  const [priceText, setPriceText] = useState(initial ? String(initial.price_cents / 100) : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY)
      setPriceText(initial ? String(initial.price_cents / 100) : '')
      setError(null)
    }
  }, [open, initial])

  function set<K extends keyof PackageFormValues>(k: K, v: PackageFormValues[K]) {
    setValues(s => ({ ...s, [k]: v }))
  }

  function toggleService(id: string) {
    setValues(s => ({
      ...s,
      service_ids: s.service_ids.includes(id) ? s.service_ids.filter(x => x !== id) : [...s.service_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) { setError('Package name is required.'); return }
    setSubmitting(true); setError(null)
    try {
      await onSubmit({ ...values, price_cents: toCents(priceText) })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeServices = services.filter(s => s.is_active)

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={mode === 'create' ? 'Create package' : 'Edit package'}
      subtitle="Bundle services into something clients can buy."
      width={600}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="package-form" loading={submitting}>
            {mode === 'create' ? 'Create package' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="package-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Package name" value={values.name} onChange={e => set('name', e.target.value)} placeholder="Growth Plan" autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, alignItems: 'end' }}>
          <Input label="Price (USD)" value={priceText} onChange={e => setPriceText(e.target.value)} placeholder="2500" inputMode="decimal"
            hint={priceText ? money(toCents(priceText)) : 'Leave blank for $0'} />
          <Select label="Billing frequency" value={values.billing_frequency} onChange={e => set('billing_frequency', e.target.value as PackageFormValues['billing_frequency'])}
            options={BILLING_FREQ_OPTIONS} />
        </div>
        <Textarea label="Description" value={values.description} onChange={e => set('description', e.target.value)} placeholder="Who this package is for…" rows={2} />

        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Included services</p>
          {activeServices.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>No active services yet — create services first to add them here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 12, padding: 8 }}>
              {activeServices.map(s => {
                const on = values.service_ids.includes(s.id)
                return (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      padding: '9px 11px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${on ? 'var(--violet)' : 'var(--hairline)'}`,
                      background: on ? 'var(--lavender-soft)' : 'var(--surface-solid)',
                      fontFamily: 'var(--font-sans)', transition: 'all 120ms ease',
                    }}>
                    <span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>{money(s.price_cents)}</span>
                    </span>
                    <span style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
                      border: `1px solid ${on ? 'var(--violet)' : 'var(--hairline)'}`, background: on ? 'var(--violet)' : 'transparent',
                    }}>
                      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <ActiveToggle checked={values.is_active} onChange={v => set('is_active', v)} />
        {error && <ErrBox>{error}</ErrBox>}
      </form>
    </Modal>
  )
}
