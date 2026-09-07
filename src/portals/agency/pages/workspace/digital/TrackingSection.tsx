import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import { ErrorBanner, Skel, EmptyState, ConfirmModal } from './WebsiteSection'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { TrackingConfiguration, DigitalIntegrationStatus, Website } from '@/types'

const STATUS_BADGE: Record<DigitalIntegrationStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  manual: 'default', configured: 'brand', connected: 'success', syncing: 'success', live: 'success', error: 'danger',
}

const BLANK_FORM: DG.TrackingConfigFormValues = {
  website_id: '', provider: 'ga4', custom_provider_name: '', external_id: '',
  status: 'manual', verification_status: 'unverified', last_checked_at: '', last_synced_at: '', notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function TrackingSection({ client, ctx, onChanged }: Props) {
  const [configs, setConfigs] = useState<TrackingConfiguration[]>([])
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<TrackingConfiguration | null>(null)
  const [form, setForm] = useState<DG.TrackingConfigFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TrackingConfiguration | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [c, w] = await Promise.all([DG.listTrackingConfigurations(client.id), DG.listWebsites(client.id)])
      setConfigs(c); setWebsites(w.filter(site => site.status !== 'archived'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tracking configurations')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(c: TrackingConfiguration) {
    setEditing(c)
    setForm({
      website_id: c.website_id ?? '', provider: c.provider, custom_provider_name: c.custom_provider_name ?? '',
      external_id: c.external_id ?? '', status: c.status, verification_status: c.verification_status,
      last_checked_at: c.last_checked_at ? c.last_checked_at.slice(0, 10) : '',
      last_synced_at: c.last_synced_at ? c.last_synced_at.slice(0, 10) : '',
      notes: c.notes ?? '',
    })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    if (form.provider === 'custom' && !form.custom_provider_name.trim()) { setFormErr('Enter a name for this custom provider'); return }
    setSaving(true); setFormErr(null)
    try {
      if (editing) await DG.updateTrackingConfiguration(editing.id, form, ctx)
      else await DG.createTrackingConfiguration(client.id, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save tracking configuration')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: TrackingConfiguration) {
    setDeletingId(c.id); setError(null)
    try { await DG.deleteTrackingConfiguration(c.id); setConfirmDelete(null); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to remove tracking configuration') }
    finally { setDeletingId(null) }
  }

  const websiteName = (id: string | null) => id ? websites.find(w => w.id === id)?.name ?? 'Unknown website' : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Tracking &amp; Analytics</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Analytics and tracking systems configured for this client — a configuration registry, not a live reporting dashboard.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">New Configuration</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && configs.length === 0 && (
        <EmptyState
          title="No tracking configured yet"
          description="Record this client's analytics and tracking setup — GA4, GTM, Meta Pixel, and more. Manual entries are valid; no live connection is required."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Add first configuration</Button>}
        />
      )}

      {!loading && configs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {configs.map(c => (
            <TrackingCard
              key={c.id}
              config={c}
              websiteName={websiteName(c.website_id)}
              onEdit={() => openEdit(c)}
              onDelete={() => setConfirmDelete(c)}
            />
          ))}
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Tracking Configuration' : 'New Tracking Configuration'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Create Configuration'}</Button>
          </>
        }
      >
        <TrackingForm form={form} setForm={setForm} formErr={formErr} websites={websites} />
      </DrawerPanel>

      {confirmDelete && (
        <ConfirmModal
          title="Remove tracking configuration?"
          body={`${confirmDelete.provider === 'custom' ? (confirmDelete.custom_provider_name ?? 'Custom') : DG.TRACKING_PROVIDER_LABELS[confirmDelete.provider]} will be permanently removed. This table has no archive state — this cannot be undone.`}
          confirmLabel="Remove"
          danger
          loading={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </div>
  )
}

/* ── Form ─────────────────────────────────────────────────── */

function TrackingForm({ form, setForm, formErr, websites }: {
  form: DG.TrackingConfigFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.TrackingConfigFormValues>>
  formErr: string | null
  websites: Website[]
}) {
  const isCustom = form.provider === 'custom'
  const websiteOptions = [{ value: '', label: 'Not tied to a specific website' }, ...websites.map(w => ({ value: w.id, label: w.name }))]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Select label="Provider *" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value as DG.TrackingConfigFormValues['provider'] }))} options={DG.TRACKING_PROVIDER_OPTIONS} />
      {isCustom && (
        <Input label="Custom provider name *" value={form.custom_provider_name} onChange={e => setForm(f => ({ ...f, custom_provider_name: e.target.value }))} placeholder="e.g. Hotjar" />
      )}
      <Select label="Website" value={form.website_id} onChange={e => setForm(f => ({ ...f, website_id: e.target.value }))} options={websiteOptions} hint="A client with multiple websites may need a separate property/container per site." />
      <Input label="Property / container / pixel ID" value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))} placeholder="Optional — leave blank for manual entries" hint="Never a credential — if entered, this exact provider + ID must be unique for this client." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DG.TrackingConfigFormValues['status'] }))} options={DG.INTEGRATION_STATUS_OPTIONS} />
        <Select label="Verification" value={form.verification_status} onChange={e => setForm(f => ({ ...f, verification_status: e.target.value as DG.TrackingConfigFormValues['verification_status'] }))} options={DG.VERIFICATION_STATUS_OPTIONS} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Last checked" type="date" value={form.last_checked_at} onChange={e => setForm(f => ({ ...f, last_checked_at: e.target.value }))} />
        <Input label="Last synced" type="date" value={form.last_synced_at} onChange={e => setForm(f => ({ ...f, last_synced_at: e.target.value }))} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────── */

function TrackingCard({ config, websiteName, onEdit, onDelete }: {
  config: TrackingConfiguration
  websiteName: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  const providerLabel = config.provider === 'custom' ? (config.custom_provider_name ?? 'Custom') : DG.TRACKING_PROVIDER_LABELS[config.provider]
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{providerLabel}</p>
            <Badge variant={STATUS_BADGE[config.status]}>{DG.INTEGRATION_STATUS_LABELS[config.status]}</Badge>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            {[config.external_id ? `ID: ${config.external_id}` : 'No ID on file', websiteName].filter(Boolean).join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{DG.VERIFICATION_STATUS_LABELS[config.verification_status]}</span>
            {config.last_checked_at && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Checked {new Date(config.last_checked_at).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">Edit</Button>
        <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--danger)', marginLeft: 'auto' }} className="min-h-[44px]">Remove</Button>
      </div>
    </div>
  )
}
