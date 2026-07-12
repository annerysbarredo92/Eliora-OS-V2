import { useState, useEffect, useCallback } from 'react'
import * as RT from '@/features/retainers/api'
import { money, toCents } from '@/features/operations/helpers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Client, Retainer, RetainerStatus, RetainerFrequency } from '@/types'

const STATUS_BADGE: Record<RetainerStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  active: 'success', paused: 'warning', completed: 'default', cancelled: 'danger',
}

const FREQUENCY_OPTIONS: { value: RetainerFrequency; label: string }[] = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually',  label: 'Annually' },
  { value: 'custom',    label: 'Custom' },
]

const STATUS_OPTIONS: { value: RetainerStatus; label: string }[] = [
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const BLANK_FORM: RT.RetainerFormValues = {
  title:             '',
  description:       '',
  status:            'active',
  frequency:         'monthly',
  amount_cents:      0,
  start_date:        '',
  end_date:          '',
  next_billing_date: '',
  is_auto_renew:     false,
  notes:             '',
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Retainer | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setRetainers(await RT.listRetainers(client.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load retainers')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(BLANK_FORM)
    setAmountStr('')
    setFormErr(null)
    setDrawerOpen(true)
  }

  function openEdit(r: Retainer) {
    setEditing(r)
    setForm({
      title:             r.title,
      description:       r.description ?? '',
      status:            r.status,
      frequency:         r.frequency,
      amount_cents:      r.amount_cents,
      start_date:        r.start_date ?? '',
      end_date:          r.end_date ?? '',
      next_billing_date: r.next_billing_date ?? '',
      is_auto_renew:     r.is_auto_renew,
      notes:             r.notes ?? '',
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

  async function handleDelete(r: Retainer) {
    setDeletingId(r.id)
    try {
      await RT.deleteRetainer(r.id, client.id, ctx)
      setConfirmDelete(null); await load(); onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  async function quickStatus(r: Retainer, status: RetainerStatus) {
    try {
      await RT.setRetainerStatus(r.id, client.id, status, ctx)
      await load(); onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const active    = retainers.filter(r => r.status === 'active' || r.status === 'paused')
  const inactive  = retainers.filter(r => r.status === 'completed' || r.status === 'cancelled')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Retainers</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Ongoing agreements and scheduled billing for {client.business_name}.</p>
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
          description="Set up a retainer to document your ongoing agreement, billing schedule, and amount."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Create first retainer</Button>}
        />
      )}

      {!loading && active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: inactive.length > 0 ? 24 : 0 }}>
          {active.map(r => (
            <RetainerCard
              key={r.id}
              retainer={r}
              onEdit={() => openEdit(r)}
              onPause={() => quickStatus(r, r.status === 'active' ? 'paused' : 'active')}
              onComplete={() => quickStatus(r, 'completed')}
              onDelete={() => setConfirmDelete(r)}
            />
          ))}
        </div>
      )}

      {!loading && inactive.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
            Completed / Cancelled
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inactive.map(r => (
              <RetainerCard
                key={r.id}
                retainer={r}
                onEdit={() => openEdit(r)}
                onReactivate={() => quickStatus(r, 'active')}
                onDelete={() => setConfirmDelete(r)}
              />
            ))}
          </div>
        </div>
      )}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Monthly Marketing Retainer" />
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Amount (USD)"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              inputMode="decimal"
              hint={amountStr ? money(toCents(amountStr)) : ''}
            />
            <Select
              label="Frequency"
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value as RetainerFrequency }))}
              options={FREQUENCY_OPTIONS}
            />
          </div>
          <Select
            label="Status"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as RetainerStatus }))}
            options={STATUS_OPTIONS}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Start date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input label="End date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <Input label="Next billing date" type="date" value={form.next_billing_date} onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_auto_renew}
              onChange={e => setForm(f => ({ ...f, is_auto_renew: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--violet)' }}
            />
            <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>Auto-renew</span>
          </label>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
        </div>
      </DrawerPanel>

      {confirmDelete && (
        <ConfirmDeleteModal
          retainer={confirmDelete}
          deleting={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </div>
  )
}

/* ── Retainer card ───────────────────────────────────────── */

function RetainerCard({ retainer, onEdit, onPause, onComplete, onReactivate, onDelete }: {
  retainer: Retainer
  onEdit: () => void
  onPause?: () => void
  onComplete?: () => void
  onReactivate?: () => void
  onDelete: () => void
}) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{retainer.title}</p>
            <Badge variant={STATUS_BADGE[retainer.status]}>{RT.STATUS_LABELS[retainer.status]}</Badge>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>
            {money(retainer.amount_cents)} / {RT.FREQUENCY_LABELS[retainer.frequency].toLowerCase()}
          </p>
          {retainer.description && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{retainer.description}</p>
          )}
          <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            {retainer.start_date && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Started {new Date(retainer.start_date).toLocaleDateString()}</p>
            )}
            {retainer.next_billing_date && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Next billing {new Date(retainer.next_billing_date).toLocaleDateString()}</p>
            )}
            {retainer.end_date && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Ends {new Date(retainer.end_date).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
        {onPause && retainer.status === 'active' && (
          <Button variant="ghost" size="sm" onClick={onPause}>Pause</Button>
        )}
        {onPause && retainer.status === 'paused' && (
          <Button variant="ghost" size="sm" onClick={onPause}>Resume</Button>
        )}
        {onComplete && (retainer.status === 'active' || retainer.status === 'paused') && (
          <Button variant="ghost" size="sm" onClick={onComplete}>Mark Completed</Button>
        )}
        {onReactivate && (
          <Button variant="ghost" size="sm" onClick={onReactivate}>Reactivate</Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>Delete</Button>
      </div>
    </div>
  )
}

/* ── Confirm delete modal ────────────────────────────────── */

function ConfirmDeleteModal({ retainer, deleting, onCancel, onConfirm }: {
  retainer: Retainer
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
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
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Delete retainer?</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          "{retainer.title}" will be permanently deleted. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" loading={deleting} onClick={onConfirm} style={{ background: 'var(--danger)' }}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */

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
