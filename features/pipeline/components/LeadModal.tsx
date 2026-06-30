import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { toCents, money } from '@/features/operations/helpers'
import type { PipelineStage } from '@/types'
import type { LeadFormValues } from '../api'

const empty = (stageId: string): LeadFormValues => ({ business_name: '', name: '', email: '', phone: '', website: '', source: '', stage_id: stageId, estimated_value_cents: 0, owner_id: '', notes: '' })

export function LeadModal({ open, mode, initial, stages, onClose, onSubmit }: {
  open: boolean; mode: 'create' | 'edit'; initial?: LeadFormValues; stages: PipelineStage[]
  onClose: () => void; onSubmit: (v: LeadFormValues) => Promise<void>
}) {
  const [v, setV] = useState<LeadFormValues>(initial ?? empty(stages[0]?.id ?? ''))
  const [valueText, setValueText] = useState(initial ? String(initial.estimated_value_cents / 100) : '')
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setV(initial ?? empty(stages[0]?.id ?? '')); setValueText(initial ? String(initial.estimated_value_cents / 100) : ''); setError(null) } }, [open, initial, stages])
  function set<K extends keyof LeadFormValues>(k: K, val: LeadFormValues[K]) { setV(s => ({ ...s, [k]: val })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!v.business_name.trim()) { setError('Business name is required.'); return }
    setBusy(true); setError(null)
    try { await onSubmit({ ...v, estimated_value_cents: toCents(valueText) }); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={mode === 'create' ? 'Add lead' : 'Edit lead'} width={560}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" type="submit" form="lead-form" loading={busy}>{mode === 'create' ? 'Add lead' : 'Save'}</Button></>}>
      <form id="lead-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Business name" value={v.business_name} onChange={e => set('business_name', e.target.value)} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Contact name" value={v.name} onChange={e => set('name', e.target.value)} />
          <Input label="Email" type="email" value={v.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Phone" value={v.phone} onChange={e => set('phone', e.target.value)} />
          <Input label="Website" value={v.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Source" value={v.source} onChange={e => set('source', e.target.value)} placeholder="Referral, Instagram…" />
          <Select label="Stage" value={v.stage_id} onChange={e => set('stage_id', e.target.value)} options={stages.map(s => ({ value: s.id, label: s.name }))} />
        </div>
        <Input label="Estimated value (USD)" value={valueText} onChange={e => setValueText(e.target.value)} inputMode="decimal" hint={valueText ? money(toCents(valueText)) : 'Deal size'} />
        <Textarea label="Notes" value={v.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '11px 13px', borderRadius: 12 }}>{error}</div>}
      </form>
    </Modal>
  )
}
