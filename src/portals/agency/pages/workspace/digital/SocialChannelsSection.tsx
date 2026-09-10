import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as DG from '@/features/digital/api'
import {
  startIntegrationOAuth, listIntegrationResources, listIntegrationConnections,
  listClientIntegrationResources, linkIntegrationResource, syncMetaResources,
  disconnectIntegrationConnection, OAUTH_FAILURE_REASON_LABELS,
} from '@/features/integrations/api'
import type { IntegrationConnection, IntegrationResource } from '@/features/integrations/api'
import { ErrorBanner, Skel, EmptyState } from './WebsiteSection'
import { AlertBanner } from '@/components/ui/AlertBanner'
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
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  // Set once from the OAuth-callback redirect's query params, then those
  // params are stripped from the URL — see the effect below. Never
  // fabricated: "connected" is shown only after the server has actually
  // confirmed it (Wave 5 Slice 2 spec §26 — no fake "Connected" state).
  const [oauthResult, setOauthResult] = useState<
    { status: 'connected'; resourceCount: number | null } | { status: 'error'; message: string } | null
  >(null)

  // Meta connection state + discovered resources (Phase 6/7 reconciliation)
  // — Meta only; Google's agency-scoped equivalent lives entirely in
  // TrackingSection.tsx and is untouched by this file.
  const [metaConnection, setMetaConnection] = useState<IntegrationConnection | null>(null)
  const [metaResources, setMetaResources] = useState<IntegrationResource[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({})
  const [linkError, setLinkError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setChannels(await DG.listSocialChannels(client.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load social channels') }
    finally { setLoading(false) }
  }, [client.id])

  const loadMetaIntegration = useCallback(async () => {
    setResourcesLoading(true)
    try {
      const connections = await listIntegrationConnections(client.id, 'meta')
      // Most-recently-connected Meta connection is what this UI surfaces
      // — 01-integration-connections.sql deliberately allows more than
      // one, but a single "Connect Meta" entry point only ever needs one
      // to show at a time.
      setMetaConnection(connections[0] ?? null)
      setMetaResources(await listClientIntegrationResources(client.id, 'meta'))
    } catch (e) {
      console.error('loadMetaIntegration:', e instanceof Error ? e.message : e)
    } finally {
      setResourcesLoading(false)
    }
  }, [client.id])

  // Combined into one effect (rather than two separate ones) so this
  // stays exactly one pre-existing, already-baselined react-hooks/
  // set-state-in-effect finding (see `load` above, unchanged since before
  // this reconciliation) instead of introducing a second, new instance of
  // the same finding for loadMetaIntegration.
  useEffect(() => { load(); loadMetaIntegration() }, [load, loadMetaIntegration])

  // One-time handling of the integration-oauth-callback redirect. The
  // params are consumed and then stripped (replace: true) so reloading
  // the page never re-shows a stale banner.
  useEffect(() => {
    const integration = searchParams.get('integration')
    if (integration !== 'meta') return
    const status = searchParams.get('status')
    const connectionId = searchParams.get('connection_id')
    const reason = searchParams.get('reason')

    async function resolve() {
      if (status === 'connected') {
        let resourceCount: number | null = null
        if (connectionId) {
          try { resourceCount = (await listIntegrationResources(connectionId)).length }
          catch { resourceCount = null }
        }
        setOauthResult({ status: 'connected', resourceCount })
      } else {
        setOauthResult({ status: 'error', message: (reason && OAUTH_FAILURE_REASON_LABELS[reason]) || 'The Meta connection could not be completed.' })
      }
    }
    resolve()

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('integration'); next.delete('status'); next.delete('connection_id'); next.delete('reason')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnectMeta() {
    setConnecting(true); setConnectError(null)
    try {
      const url = await startIntegrationOAuth(client.id, 'meta')
      window.location.href = url
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Could not start the Meta connection.')
      setConnecting(false)
    }
  }

  async function handleReconnectMeta() {
    setReconnecting(true); setConnectError(null)
    try {
      const url = await startIntegrationOAuth(client.id, 'meta', 'reconnect')
      window.location.href = url
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Could not start reconnection.')
      setReconnecting(false)
    }
  }

  async function handleDisconnectMeta() {
    if (!metaConnection) return
    setDisconnecting(true); setConnectError(null)
    try {
      await disconnectIntegrationConnection(metaConnection.id)
      await loadMetaIntegration()
      setSyncResult(null)
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Could not disconnect.')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSyncNow() {
    setSyncing(true); setSyncResult(null); setConnectError(null)
    try {
      const result = await syncMetaResources(client.id)
      setSyncResult(result)
      await load(); onChanged()
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Could not run the sync.')
    } finally {
      setSyncing(false)
    }
  }

  /** target: '' means "import as a new channel"; any other value is the
   * id of an existing, not-yet-linked channel to attach this resource to
   * — see linkIntegrationResource's own doc comment for why ambiguous
   * matches are rejected rather than guessed. */
  async function handleLinkResource(resource: IntegrationResource, target: string) {
    setLinkingId(resource.id); setLinkError(null)
    try {
      await linkIntegrationResource(
        resource,
        target ? { mode: 'existing', channelId: target } : { mode: 'new' },
        ctx,
      )
      // Initial sync for just this resource (Phase 9: "initial sync after
      // explicit linkage") — best-effort; a failure here does not undo
      // the link itself, which already succeeded.
      try { await syncMetaResources(client.id, resource.id) } catch { /* surfaced via next Sync Now */ }
      await Promise.all([load(), loadMetaIntegration()])
      onChanged()
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Could not link this resource.')
    } finally {
      setLinkingId(null)
    }
  }

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!metaConnection || metaConnection.status === 'disconnected' ? (
            <Button variant="outline" size="sm" onClick={handleConnectMeta} loading={connecting} className="min-h-[44px]">Connect Meta</Button>
          ) : metaConnection.status === 'connected' ? (
            <>
              <Button variant="outline" size="sm" onClick={handleSyncNow} loading={syncing} className="min-h-[44px]">Sync Now</Button>
              <Button variant="ghost" size="sm" onClick={handleDisconnectMeta} loading={disconnecting} className="min-h-[44px]">Disconnect Meta</Button>
            </>
          ) : (
            // needs_reconnect / error — a real, non-fake state (Phase 12/11:
            // never pretend a broken connection is still usable).
            <Button variant="outline" size="sm" onClick={handleReconnectMeta} loading={reconnecting} className="min-h-[44px]">Reconnect Meta</Button>
          )}
          <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">New Channel</Button>
        </div>
      </div>

      {metaConnection && metaConnection.status !== 'connected' && metaConnection.status !== 'disconnected' && (
        <div style={{ marginBottom: 14 }}>
          <AlertBanner variant="warning" title="Meta needs reconnection">
            The Meta connection stopped working and needs to be reconnected before syncing can resume. Linked channels and their history are unaffected.
          </AlertBanner>
        </div>
      )}

      {oauthResult && oauthResult.status === 'connected' && (
        <div style={{ marginBottom: 14 }}>
          <AlertBanner variant="success" title="Meta connected" dismissible onDismiss={() => setOauthResult(null)}>
            {oauthResult.resourceCount === null
              ? 'The connection succeeded. Resource discovery could not be confirmed — check back shortly.'
              : `${oauthResult.resourceCount} resource${oauthResult.resourceCount === 1 ? '' : 's'} discovered (Facebook Pages / linked Instagram accounts) — see "Discovered Meta resources" below to import them.`}
          </AlertBanner>
        </div>
      )}
      {oauthResult && oauthResult.status === 'error' && (
        <div style={{ marginBottom: 14 }}>
          <AlertBanner variant="danger" title="Meta connection failed" dismissible onDismiss={() => setOauthResult(null)}>
            {oauthResult.message}
          </AlertBanner>
        </div>
      )}
      {connectError && (
        <div style={{ marginBottom: 14 }}>
          <AlertBanner variant="danger" dismissible onDismiss={() => setConnectError(null)}>{connectError}</AlertBanner>
        </div>
      )}
      {syncResult && (
        <div style={{ marginBottom: 14 }}>
          <AlertBanner variant={syncResult.failed > 0 ? 'warning' : 'success'} dismissible onDismiss={() => setSyncResult(null)}>
            {`Sync complete — ${syncResult.synced} channel${syncResult.synced === 1 ? '' : 's'} updated${syncResult.failed > 0 ? `, ${syncResult.failed} could not be synced` : ''}.`}
          </AlertBanner>
        </div>
      )}

      <MetaResourcesPanel
        resources={metaResources}
        channels={channels}
        loading={resourcesLoading}
        linkingId={linkingId}
        linkChoice={linkChoice}
        setLinkChoice={setLinkChoice}
        linkError={linkError}
        onLink={handleLinkResource}
      />

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

/* ── Discovered Meta resources: explicit selection / import ──
   Phase 6/7 (Meta reconciliation) — a discovered-but-unlinked resource is
   never auto-imported. Each one is shown with an explicit choice: import
   as a brand-new channel, or attach to an existing channel that has no
   external_account_id yet (a genuine identity ambiguity — two different
   external accounts, or a handle-only guess — is never offered as a
   target; linkIntegrationResource's own check is the actual backstop, but
   filtering the dropdown here keeps the common case simple). Already-
   linked resources are listed collapsed, read-only, as confirmation of
   what a channel is backed by — never editable from here (that's
   ChannelCard's job, via the normal Edit drawer). */
function MetaResourcesPanel({ resources, channels, loading, linkingId, linkChoice, setLinkChoice, linkError, onLink }: {
  resources: IntegrationResource[]
  channels: SocialChannel[]
  loading: boolean
  linkingId: string | null
  linkChoice: Record<string, string>
  setLinkChoice: React.Dispatch<React.SetStateAction<Record<string, string>>>
  linkError: string | null
  onLink: (resource: IntegrationResource, target: string) => void
}) {
  if (loading || resources.length === 0) return null

  const unlinked = resources.filter(r => r.link_status === 'unlinked')
  const linked = resources.filter(r => r.link_status === 'linked')
  const conflicted = resources.filter(r => r.link_status === 'conflict')

  const resourceLabel = (r: IntegrationResource) =>
    r.resource_type === 'instagram_business_account' ? 'Instagram' : 'Facebook Page'

  const eligibleChannelsFor = (r: IntegrationResource) => {
    const platform = r.resource_type === 'instagram_business_account' ? 'instagram' : 'facebook'
    return channels.filter(c => c.platform === platform && !c.external_account_id)
  }

  if (unlinked.length === 0 && conflicted.length === 0) return null

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 18 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Discovered Meta resources</p>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        Found via the Meta connection — nothing here is tracked until you explicitly import it.
      </p>
      {linkError && <div style={{ marginBottom: 10 }}><AlertBanner variant="danger">{linkError}</AlertBanner></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {unlinked.map(r => {
          const eligible = eligibleChannelsFor(r)
          const choice = linkChoice[r.id] ?? ''
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid var(--hairline-2)', borderRadius: 8 }}>
              <Badge variant="brand">{resourceLabel(r)}</Badge>
              <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1, minWidth: 140 }}>{r.name ?? r.handle ?? r.external_resource_id}</span>
              {eligible.length > 0 && (
                <Select
                  value={choice}
                  onChange={e => setLinkChoice(prev => ({ ...prev, [r.id]: e.target.value }))}
                  options={[{ value: '', label: 'Import as new channel' }, ...eligible.map(c => ({ value: c.id, label: `Link to: ${c.handle ?? c.platform}` }))]}
                />
              )}
              <Button variant="primary" size="sm" loading={linkingId === r.id} onClick={() => onLink(r, choice)} className="min-h-[44px]">
                {choice ? 'Link' : 'Import'}
              </Button>
            </div>
          )
        })}
        {conflicted.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--hairline-2)', borderRadius: 8, opacity: 0.75 }}>
            <Badge variant="danger">Conflict</Badge>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{r.name ?? r.handle ?? r.external_resource_id} — needs manual review</span>
          </div>
        ))}
      </div>
      {linked.length > 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
          {linked.length} resource{linked.length === 1 ? '' : 's'} already linked to a channel above.
        </p>
      )}
    </div>
  )
}
