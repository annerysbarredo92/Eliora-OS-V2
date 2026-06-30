import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { STATUS_OPTIONS } from '../helpers'
import type { ClientFormValues } from '../api'

const EMPTY: ClientFormValues = {
  business_name: '', industry: '', website: '', business_phone: '', business_address: '',
  status: 'active', internal_notes: '',
  contact_first_name: '', contact_last_name: '', contact_email: '', contact_phone: '',
}

interface ClientFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: ClientFormValues
  onClose: () => void
  onSubmit: (values: ClientFormValues) => Promise<void>
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--violet)', margin: '6px 0 2px',
}

export function ClientFormModal({ open, mode, initial, onClose, onSubmit }: ClientFormModalProps) {
  const [values, setValues] = useState<ClientFormValues>(initial ?? EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY)
      setError(null)
    }
  }, [open, initial])

  function set<K extends keyof ClientFormValues>(key: K, val: ClientFormValues[K]) {
    setValues(v => ({ ...v, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.business_name.trim()) {
      setError('Business name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(values)
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
      title={mode === 'create' ? 'Add client' : 'Edit client'}
      subtitle={mode === 'create' ? 'Create a new client and primary contact.' : 'Update client details and primary contact.'}
      width={620}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="client-form" loading={submitting}>
            {mode === 'create' ? 'Create client' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={sectionLabel}>Business</p>
        <Input label="Business name" value={values.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Northlight Studio" autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Industry" value={values.industry} onChange={e => set('industry', e.target.value)} placeholder="Marketing" />
          <Input label="Website" value={values.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Business phone" value={values.business_phone} onChange={e => set('business_phone', e.target.value)} placeholder="(555) 000-0000" />
          <Select
            label="Status"
            value={values.status}
            onChange={e => set('status', e.target.value as ClientFormValues['status'])}
            options={STATUS_OPTIONS}
          />
        </div>
        <Input label="Business address" value={values.business_address} onChange={e => set('business_address', e.target.value)} placeholder="123 Main St, City, State" />

        <p style={sectionLabel}>Primary contact</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="First name" value={values.contact_first_name} onChange={e => set('contact_first_name', e.target.value)} placeholder="Jane" />
          <Input label="Last name" value={values.contact_last_name} onChange={e => set('contact_last_name', e.target.value)} placeholder="Ellison" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Contact email" type="email" value={values.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="jane@client.com" />
          <Input label="Contact phone" value={values.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="(555) 000-0000" />
        </div>

        <p style={sectionLabel}>Notes</p>
        <Textarea label="Internal notes" value={values.internal_notes} onChange={e => set('internal_notes', e.target.value)} placeholder="Only your team can see this." rows={3} />

        {error && (
          <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
