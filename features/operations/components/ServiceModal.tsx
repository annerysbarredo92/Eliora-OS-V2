import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { SERVICE_CATEGORIES, BILLING_TYPE_OPTIONS, money, toCents } from '../helpers'
import type { ServiceFormValues } from '../api'

const EMPTY: ServiceFormValues = {
  name: '', category: 'Content Creation', description: '',
  price_cents: 0, billing_type: 'monthly', is_active: true,
}

interface ServiceModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: ServiceFormValues
  onClose: () => void
  onSubmit: (values: ServiceFormValues) => Promise<void>
}

export function ServiceModal({ open, mode, initial, onClose, onSubmit }: ServiceModalProps) {
  const [values, setValues] = useState<ServiceFormValues>(initial ?? EMPTY)
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

  function set<K extends keyof ServiceFormValues>(k: K, v: ServiceFormValues[K]) {
    setValues(s => ({ ...s, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) { setError('Service name is required.'); return }
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

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={mode === 'create' ? 'Create service' : 'Edit service'}
      subtitle="Services are the building blocks of your packages."
      width={560}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="service-form" loading={submitting}>
            {mode === 'create' ? 'Create service' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Service name" value={values.name} onChange={e => set('name', e.target.value)} placeholder="Monthly Social Management" autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Select label="Category" value={values.category} onChange={e => set('category', e.target.value)}
            options={SERVICE_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Select label="Billing type" value={values.billing_type} onChange={e => set('billing_type', e.target.value as ServiceFormValues['billing_type'])}
            options={BILLING_TYPE_OPTIONS} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, alignItems: 'end' }}>
          <Input label="Price (USD)" value={priceText} onChange={e => setPriceText(e.target.value)} placeholder="1200" inputMode="decimal"
            hint={priceText ? money(toCents(priceText)) : 'Leave blank for $0'} />
          <ActiveToggle checked={values.is_active} onChange={v => set('is_active', v)} />
        </div>
        <Textarea label="Description" value={values.description} onChange={e => set('description', e.target.value)} placeholder="What's included…" rows={3} />
        {error && <ErrBox>{error}</ErrBox>}
      </form>
    </Modal>
  )
}

export function ActiveToggle({ checked, onChange, label = 'Active' }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', height: 50 }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: checked ? 'var(--violet)' : 'var(--hairline)', position: 'relative', transition: 'background 160ms ease',
        }}
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 160ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      <span style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
    </label>
  )
}

export function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>
      {children}
    </div>
  )
}
