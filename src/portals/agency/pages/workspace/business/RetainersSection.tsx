import { useState, useEffect, useCallback } from 'react'
import * as RT from '@/features/retainers/api'
import { money, toCents } from '@/features/operations/helpers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Client, Retainer, RetainerStatus, RetainerFrequency, RetainerIncludedService } from '@/types'

const STATUS_BADGE: Record<RetainerStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  draft:   'default',
  active:  'success',
  paused:  'warning',
  ending:  'brand',
  ended:   'default',
}

const FREQUENCY_OPTIONS: { value: RetainerFrequency; label: string }[] = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually',  label: 'Annually' },
  { value: 'custom',    label: 'Custom' },
]

// Only draft can be created directly; status is set via lifecycle actions after creation.
const CREATE_STATUS_OPTIONS: { value: RetainerStatus; label: string }[] = [
  { value: 'draft',  label: 'Draft' },
  { value: 'active', label: 'Active' },
]

const BLANK_FORM: RT.RetainerFormValues = {
  title:              '',
  description:        '',
  status:             'draft',
  frequency:          'monthly',
  amount_cents:       0,
  start_date:         '',
  end_date:           '',
  next_billing_date:  '',
  is_auto_renew:      false,
  included_services:  [],
  linked_proposal_id: '',
  linked_contract_id: '',
  notes:              '',
}

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function RetainersSection({ client, ctx, onChanged }: Props) {
  const [retainers, setRetainers] = useState<Retainer[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing]     = useState<Retainer | null>(null)
  const [form, setForm]           = useState<RT.RetainerFormValues>(BLANK_FORM)
  const [amountStr, setAmountStr] = useState('')
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Retainer | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [renewTarget, setRenewTarget]     = useState<Retainer | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setRetainers(await RT.listRetainers(client.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load retainers') }
    finally   { setLoading(false) }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setAmountStr(''); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(r: Retainer) {
    setEditing(r)
    setForm({
      title:              r.title,
      description:        r.description ?? '',
      status:             r.status,
      frequency:          r.frequency,
      amount_cents:       r.amount_cents,
      start_date:         r.start_date ?? '',
      end_date:           r.end_date ?? '',
      next_billing_date:  r.next_billing_date ?? '',
      is_auto_renew:      r.is_auto_renew,
      included_services:  r.included_services ?? [],
      linked_proposal_id: r.linked_proposal_id ?? '',
      linked_contract_id: r.linked_contract_id ?? '',
      notes:              r.notes ?? '',
    })
    setAmountStr(r.amount_cents > 0 ? (r.amount_cents / 100).toFixed(2) : '')
    setFormErr(null)
    setDrawerOpen(true)
  }

  async function save() {
    if (!form.title.trim()) { setFormErr('Title is required'); return }
    const cents = toCents(amountStr)
    if (cents < 0) { setFormErr('Enter a valid amount'); return }
    setSaving(true); setFormErr(null)
    const values: RT.RetainerFormValues = { ...form, amount_cents: cents }
    try {
      if (editing) {
        await RT.updateRetainer(editing.id, client.id, values, ctx)
      } else {
        await RT.createRetainer(client.id, values, ctx)
      }
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function quickStatus(r: Retainer, to: RetainerStatus) {
    try {
      await RT.setRetainerStatus(r, to, ctx)
      await load(); onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  async function handleDelete(r: Retainer) {
    setDeletingId(r.id)
    try {
      await RT.deleteRetainer(r, ctx)
      setConfirmDelete(null); await load(); onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const current  = retainers.filter(r => r.status !== 'ended')
  const ended    = retainers.filter(r => r.status === 'ended')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Retainers</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Ongoing agreements and billing configuration for {client.business_name}.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>New Retainer</Button>
      </div>

      {error && (
        <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 14 }}>
          <p style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {loading && <Skel />}

      {!loading && retainers.length === 0 && (
        <EmptyState
          title="No retainers yet"
          description="Create a retainer to document your ongoing agreement, billing schedule, and included services."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Create first retainer</Button>}
        />
      )}

      {!loading && current.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: ended.length > 0 ? 28 : 0 }}>
          {current.map(r => (
            <RetainerCard
              key={r.id}
              retainer={r}
              onEdit={() => openEdit(r)}
              onActivate={r.status === 'draft' ? () => quickStatus(r, 'active') : undefined}
              onPause={r.status === 'active' ? () => quickStatus(r, 'paused') : undefined}
              onResume={r.status === 'paused' ? () => quickStatus(r, 'active') : undefined}
              onMarkEnding={(r.status === 'active' || r.status === 'paused') ? () => quickStatus(r, 'ending') : undefined}
              onEnd={(r.status === 'active' || r.status === 'paused' || r.status === 'ending') ? () => quickStatus(r, 'ended') : undefined}
              onRenew={(r.status === 'active' || r.status === 'paused' || r.status === 'ending') ? () => setRenewTarget(r) : undefined}
              onDelete={r.status === 'draft' ? () => setConfirmDelete(r) : undefined}
            />
          ))}
        </div>
      )}

      {!loading && ended.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
            Ended
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ended.map(r => (
              <RetainerCard
                key={r.id}
                retainer={r}
                onRenew={() => setRenewTarget(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit drawer ──────────────────────────────── */}
      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Retainer' : 'New Retainer'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>
              {editing ? 'Save Changes' : 'Create Retainer'}
            </Button>
          </>
        }
      >
        <RetainerForm
          form={form}
          setForm={setForm}
          amountStr={amountStr}
          setAmountStr={setAmountStr}
          formErr={formErr}
          isEdit={!!editing}
          editingStatus={editing?.status}
        />
      </DrawerPanel>

      {/* ── Confirm delete draft ─────────────────────────────── */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete draft retainer?"
          body={`"${confirmDelete.title}" is a draft and will be permanently removed.`}
          confirmLabel="Delete"
          danger
          loading={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}

      {/* ── Renew modal ──────────────────────────────────────── */}
      {renewTarget && (
        <RenewModal
          retainer={renewTarget}
          ctx={ctx}
          onClose={() => setRenewTarget(null)}
          onRenewed={async () => { setRenewTarget(null); await load(); onChanged() }}
        />
      )}
    </div>
  )
}

/* ── Retainer form (shared create / edit) ─────────────────── */

function RetainerForm({
  form, setForm, amountStr, setAmountStr, formErr, isEdit, editingStatus,
}: {
  form: RT.RetainerFormValues
  setForm: React.Dispatch<React.SetStateAction<RT.RetainerFormValues>>
  amountStr: string
  setAmountStr: (v: string) => void
  formErr: string | null
  isEdit: boolean
  editingStatus?: RetainerStatus
}) {
  function addService() {
    setForm(f => ({
      ...f,
      included_services: [
        ...f.included_services,
        { name: '', description: null, sort_order: f.included_services.length + 1 },
      ],
    }))
  }

  function updateService(idx: number, field: 'name' | 'description', val: string) {
    setForm(f => ({
      ...f,
      included_services: f.included_services.map((s, i) =>
        i === idx ? { ...s, [field]: field === 'description' ? (val || null) : val } : s
      ),
    }))
  }

  function removeService(idx: number) {
    setForm(f => ({
      ...f,
      included_services: f.included_services
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, sort_order: i + 1 })),
    }))
  }

  // Ended retainers are view-only; block editing ended status via form
  const isEnded = editingStatus === 'ended'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isEnded && (
        <div style={{ background: 'color-mix(in srgb, var(--muted) 10%, var(--surface-solid))', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>This retainer has ended. Its terms are preserved as history.</p>
        </div>
      )}

      <Input
        label="Title *"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="e.g. Monthly Marketing Retainer"
        disabled={isEnded}
      />
      <Textarea
        label="Description"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        rows={2}
        disabled={isEnded}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input
          label="Amount (USD)"
          value={amountStr}
          onChange={e => setAmountStr(e.target.value)}
          inputMode="decimal"
          hint={amountStr ? money(toCents(amountStr)) : ''}
          disabled={isEnded}
        />
        <Select
          label="Frequency"
          value={form.frequency}
          onChange={e => setForm(f => ({ ...f, frequency: e.target.value as RetainerFrequency }))}
          options={FREQUENCY_OPTIONS}
          disabled={isEnded}
        />
      </div>

      {!isEdit && (
        <Select
          label="Starting status"
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value as RetainerStatus }))}
          options={CREATE_STATUS_OPTIONS}
          hint="Set to Draft to configure before activating."
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Start date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} disabled={isEnded} />
        <Input label="End date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} disabled={isEnded} />
      </div>
      <Input label="Next billing date" type="date" value={form.next_billing_date} onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} disabled={isEnded} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isEnded ? 'default' : 'pointer' }}>
        <input
          type="checkbox"
          checked={form.is_auto_renew}
          onChange={e => setForm(f => ({ ...f, is_auto_renew: e.target.checked }))}
          disabled={isEnded}
          style={{ width: 16, height: 16, accentColor: 'var(--violet)' }}
        />
        <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>Auto-renew</span>
      </label>

      {/* ── Included agency services ──────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Included Services
          </p>
          {!isEnded && (
            <Button variant="ghost" size="sm" onClick={addService}>+ Add service</Button>
          )}
        </div>
        {form.included_services.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '8px 0' }}>No included services listed.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {form.included_services.map((svc, idx) => (
              <div key={idx} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, border: '1px solid var(--hairline-2)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <Input
                    label="Service name *"
                    value={svc.name}
                    onChange={e => updateService(idx, 'name', e.target.value)}
                    placeholder="e.g. Social media management"
                    disabled={isEnded}
                  />
                  {!isEnded && (
                    <button
                      onClick={() => removeService(idx)}
                      style={{ marginTop: 22, flexShrink: 0, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                      title="Remove"
                    >×</button>
                  )}
                </div>
                <Input
                  label="Description (optional)"
                  value={svc.description ?? ''}
                  onChange={e => updateService(idx, 'description', e.target.value)}
                  placeholder="Brief description..."
                  disabled={isEnded}
                />
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
          These describe what your agency provides. Changes to your service catalog will not affect saved retainer terms.
        </p>
      </div>

      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} disabled={isEnded} />

      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Retainer card ─────────────────────────────────────────── */

function RetainerCard({
  retainer, onEdit, onActivate, onPause, onResume, onMarkEnding, onEnd, onRenew, onDelete,
}: {
  retainer: Retainer
  onEdit?: () => void
  onActivate?: () => void
  onPause?: () => void
  onResume?: () => void
  onMarkEnding?: () => void
  onEnd?: () => void
  onRenew?: () => void
  onDelete?: () => void
}) {
  const isEnded = retainer.status === 'ended'

  return (
    <div style={{
      background: 'var(--surface-solid)',
      border: `1px solid ${isEnded ? 'var(--hairline-2)' : 'var(--hairline)'}`,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      opacity: isEnded ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{retainer.title}</p>
            <Badge variant={STATUS_BADGE[retainer.status]}>{RT.STATUS_LABELS[retainer.status]}</Badge>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>
            {money(retainer.amount_cents)} / {RT.FREQUENCY_LABELS[retainer.frequency].toLowerCase()}
          </p>
          {retainer.description && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{retainer.description}</p>
          )}

          {/* Included services preview */}
          {retainer.included_services && retainer.included_services.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Included</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {retainer.included_services.slice(0, 4).map((s, i) => (
                  <span key={i} style={{ fontSize: 11.5, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--hairline-2)', borderRadius: 6, padding: '2px 8px' }}>
                    {s.name}
                  </span>
                ))}
                {retainer.included_services.length > 4 && (
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>+{retainer.included_services.length - 4} more</span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            {retainer.start_date && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {isEnded ? 'Started' : 'Since'} {new Date(retainer.start_date).toLocaleDateString()}
              </p>
            )}
            {retainer.next_billing_date && !isEnded && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Next billing {new Date(retainer.next_billing_date).toLocaleDateString()}
              </p>
            )}
            {retainer.end_date && (
              <p style={{ fontSize: 11.5, color: retainer.status === 'ending' ? 'var(--warning)' : 'var(--muted)' }}>
                {retainer.status === 'ending' ? 'Ending' : 'Ends'} {new Date(retainer.end_date).toLocaleDateString()}
              </p>
            )}
            {retainer.ended_at && isEnded && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Ended {new Date(retainer.ended_at).toLocaleDateString()}
              </p>
            )}
            {retainer.previous_retainer_id && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>↩ Renewal</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>}
        {onActivate && <Button variant="primary" size="sm" onClick={onActivate}>Activate</Button>}
        {onPause  && <Button variant="ghost" size="sm" onClick={onPause}>Pause</Button>}
        {onResume && <Button variant="ghost" size="sm" onClick={onResume}>Resume</Button>}
        {onMarkEnding && (
          <Button variant="ghost" size="sm" onClick={onMarkEnding}>Mark Ending</Button>
        )}
        {onEnd && (
          <Button variant="ghost" size="sm" onClick={onEnd} style={{ color: 'var(--danger)' }}>End</Button>
        )}
        {onRenew && (
          <Button variant="ghost" size="sm" onClick={onRenew} style={{ marginLeft: 'auto' }}>Renew</Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--danger)', marginLeft: onRenew ? 0 : 'auto' }}>Delete</Button>
        )}
      </div>
    </div>
  )
}

/* ── Renewal modal ─────────────────────────────────────────── */

function RenewModal({ retainer, ctx, onClose, onRenewed }: {
  retainer: Retainer
  ctx: { agencyId: string; actorId: string }
  onClose: () => void
  onRenewed: () => Promise<void>
}) {
  const [form, setForm] = useState<RT.RenewRetainerValues>({
    new_amount_cents: retainer.amount_cents,
    new_frequency:    retainer.frequency,
    new_start_date:   '',
    new_end_date:     '',
    new_next_billing: '',
    notes:            retainer.notes ?? '',
  })
  const [amountStr, setAmountStr] = useState(
    retainer.amount_cents > 0 ? (retainer.amount_cents / 100).toFixed(2) : ''
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = toCents(amountStr)
    if (cents < 0) { setErr('Enter a valid amount'); return }
    setBusy(true); setErr(null)
    try {
      await RT.renewRetainer(retainer, { ...form, new_amount_cents: cents }, ctx)
      await onRenewed()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to renew')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Renew Retainer"
      subtitle={`Renewing "${retainer.title}" — old record will be marked Ended`}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="renew-form" loading={busy}>Confirm Renewal</Button>
        </>
      }
    >
      <form id="renew-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'color-mix(in srgb, var(--violet) 6%, var(--surface-solid))', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          The previous retainer's terms, included services, and billing history are preserved in full.
          A new active retainer will be created with the terms below.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            label="New amount (USD)"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            inputMode="decimal"
            hint={amountStr ? money(toCents(amountStr)) : ''}
          />
          <Select
            label="Frequency"
            value={form.new_frequency}
            onChange={e => setForm(f => ({ ...f, new_frequency: e.target.value as RetainerFrequency }))}
            options={FREQUENCY_OPTIONS}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="New start date" type="date" value={form.new_start_date} onChange={e => setForm(f => ({ ...f, new_start_date: e.target.value }))} />
          <Input label="New end date" type="date" value={form.new_end_date} onChange={e => setForm(f => ({ ...f, new_end_date: e.target.value }))} />
        </div>
        <Input label="Next billing date" type="date" value={form.new_next_billing} onChange={e => setForm(f => ({ ...f, new_next_billing: e.target.value }))} />
        <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        {err && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
      </form>
    </Modal>
  )
}

/* ── Generic confirm modal ─────────────────────────────────── */

function ConfirmModal({ title, body, confirmLabel, danger, loading, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string; danger?: boolean
  loading: boolean; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div
      role="presentation"
      onMouseDown={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,20,48,0.4)', display: 'grid', placeItems: 'center', padding: 20 }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ background: 'var(--surface-solid)', borderRadius: 'var(--radius)', padding: 28, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-glass)' }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={onConfirm}
            style={danger ? { background: 'var(--danger)' } : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */

function Skel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1].map(i => (
        <div key={i} style={{ height: 100, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.5 }} />
      ))}
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{description}</p>
      {action}
    </div>
  )
}
