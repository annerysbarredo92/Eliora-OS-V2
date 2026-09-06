import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import { ErrorBanner, Skel, EmptyState } from './WebsiteSection'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { SocialChannel, DigitalOwnershipStatus, DigitalIntegrationStatus } from '@/types'

const OWNERSHIP_BADGE: Record<DigitalOwnershipStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  owned: 'success', shared_access: 'brand', no_access: 'danger', unknown: 'default',
}
const CONNECTION_BADGE: Record<DigitalIntegrationStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  manual: 'default', configured: 'brand', connected: 'brand', syncing: 'warning', live: 'success', error: 'danger',
}

const BLANK_FORM: DG.SocialChannelFormValues = {
  platform: 'instagram', platform_other_label: '', handle: '', profile_url: '',
  external_account_id: '', account_type: '', ownership_status: 'unknown',
  integration_status: 'manual', is_active: true, notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onViewTracker?: (channel: SocialChannel) => void
}

export function SocialChannelsSection({ client, ctx, onChanged, onViewTracker }: Props) {
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<SocialChannel | null>(null)
  const [form, setForm] = useState<DG.SocialChannelFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setChannels(await DG.listSocialChannels(client.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load social channels') }
    finally { setLoading(false) }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(c: SocialChannel) {
    setEditing(c)
    setForm({
      platform: c.platform, platform_other_label: c.platform_other_label ?? '',
      handle: c.handle ?? '', profile_url: c.profile_url ?? '',
      external_account_id: c.external_account_id ?? '', account_type: c.account_type ?? '',
      ownership_status: c.ownership_status, integration_status: c.integration_status,
      is_active: c.is_active, notes: c.notes ?? '',
    })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    if (form.platform === 'other' && !form.platform_other_label.trim()) { setFormErr('Enter a label for this platform'); return }
    if (!DG.isValidUrl(form.profile_url)) { setFormErr('Enter a valid profile URL'); return }
    setSaving(true); setFormErr(null)
    try {
      if (editing) await DG.updateSocialChannel(editing.id, form, ctx)
      else await DG.createSocialChannel(client.id, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save channel')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(c: SocialChannel) {
    setTogglingId(c.id); setError(null)
    try {
      if (c.is_active) await DG.deactivateSocialChannel(c, ctx)
      else await DG.reactivateSocialChannel(c, ctx)
      await load(); onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update channel status')
    } finally {
      setTogglingId(null)
    }
  }

  const active = channels.filter(c => c.is_active)
  const inactive = channels.filter(c => !c.is_active)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Social Channels</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>This client's social account infrastructure — multiple accounts per platform are expected.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">New Channel</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && channels.length === 0 && (
        <EmptyState
          title="No social channels yet"
          description="Add this client's Instagram, Facebook, TikTok, LinkedIn, or other accounts — no API connection required to start tracking them."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Add first channel</Button>}
        />
      )}

      {!loading && active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: inactive.length > 0 ? 28 : 0 }}>
          {active.map(c => (
            <ChannelCard key={c.id} channel={c} toggling={togglingId === c.id} onEdit={() => openEdit(c)} onToggleActive={() => handleToggleActive(c)} onViewTracker={onViewTracker ? () => onViewTracker(c) : undefined} />
          ))}
        </div>
      )}

      {!loading && inactive.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Inactive</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inactive.map(c => (
              <ChannelCard key={c.id} channel={c} toggling={togglingId === c.id} onEdit={() => openEdit(c)} onToggleActive={() => handleToggleActive(c)} />
            ))}
          </div>
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Social Channel' : 'New Social Channel'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Create Channel'}</Button>
          </>
        }
      >
        <ChannelForm form={form} setForm={setForm} formErr={formErr} />
      </DrawerPanel>
    </div>
  )
}

/* ── Form ─────────────────────────────────────────────────── */

function ChannelForm({ form, setForm, formErr }: {
  form: DG.SocialChannelFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.SocialChannelFormValues>>
  formErr: string | null
}) {
  const isOther = form.platform === 'other'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Select label="Platform *" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value as DG.SocialChannelFormValues['platform'] }))} options={DG.SOCIAL_PLATFORM_OPTIONS} />
      {isOther && (
        <Input label="Platform label *" value={form.platform_other_label} onChange={e => setForm(f => ({ ...f, platform_other_label: e.target.value }))} placeholder="e.g. Snapchat" />
      )}
      <Input
        label="Handle / account name"
        value={form.handle}
        onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
        placeholder="@handle, or a page/channel name"
        hint="Not every platform uses @handles — a LinkedIn or Facebook Page name works here too. Leave blank if unknown."
      />
      <Input label="Profile URL" value={form.profile_url} onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))} placeholder="https://…" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Account type" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))} placeholder="e.g. Business, Creator" />
        <Input
          label="Platform account ID"
          value={form.external_account_id}
          onChange={e => setForm(f => ({ ...f, external_account_id: e.target.value }))}
          placeholder="Optional — leave blank for manual entries"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Ownership / access" value={form.ownership_status} onChange={e => setForm(f => ({ ...f, ownership_status: e.target.value as DG.SocialChannelFormValues['ownership_status'] }))} options={DG.OWNERSHIP_STATUS_OPTIONS} />
        <Select label="Connection status" value={form.integration_status} onChange={e => setForm(f => ({ ...f, integration_status: e.target.value as DG.SocialChannelFormValues['integration_status'] }))} options={DG.INTEGRATION_STATUS_OPTIONS} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--violet)' }} />
        <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>Active</span>
      </label>
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>No API connection is required — manually tracked channels are fully valid.</p>
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────── */

function ChannelCard({ channel, toggling, onEdit, onToggleActive, onViewTracker }: {
  channel: SocialChannel
  toggling?: boolean
  onEdit: () => void
  onToggleActive: () => void
  onViewTracker?: () => void
}) {
  const platformLabel = channel.platform === 'other' ? (channel.platform_other_label ?? 'Other') : DG.SOCIAL_PLATFORM_LABELS[channel.platform]
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', opacity: channel.is_active ? 1 : 0.72 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{platformLabel}{channel.handle ? ` — ${channel.handle}` : ''}</p>
            <Badge variant={OWNERSHIP_BADGE[channel.ownership_status]}>{DG.OWNERSHIP_STATUS_LABELS[channel.ownership_status]}</Badge>
            <Badge variant={CONNECTION_BADGE[channel.integration_status]}>{DG.INTEGRATION_STATUS_LABELS[channel.integration_status]}</Badge>
            {!channel.is_active && <Badge variant="default">Inactive</Badge>}
          </div>
          {channel.profile_url ? (
            <a href={DG.normalizeUrl(channel.profile_url)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--violet)', textDecoration: 'none' }}>{channel.profile_url}</a>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>No profile URL on file</p>
          )}
          {channel.account_type && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{channel.account_type}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">Edit</Button>
        {onViewTracker && <Button variant="ghost" size="sm" onClick={onViewTracker} className="min-h-[44px]">View Tracker</Button>}
        <Button variant="ghost" size="sm" onClick={onToggleActive} loading={toggling} style={{ color: channel.is_active ? 'var(--danger)' : undefined, marginLeft: 'auto' }} className="min-h-[44px]">
          {channel.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    </div>
  )
}
