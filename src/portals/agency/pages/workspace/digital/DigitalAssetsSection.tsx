import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import * as Files from '@/features/files/api'
import { formatBytes } from '@/lib/storage'
import { ErrorBanner, Skel, EmptyState, ConfirmModal } from './WebsiteSection'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type {
  DigitalAsset, ClientAsset, Website, Domain, SocialChannel, BusinessListing,
} from '@/types'

// Digital Assets is a REFERENCE layer only — it never stores a file of its
// own. client_asset_id always points at an existing row in the canonical
// client_assets store (features/files/api.ts). Linking picks from files
// already uploaded there; unlinking here never deletes the underlying
// file. See digital_assets' Wave 1 header + Wave 4 spec §21-24.

const BLANK_FORM: DG.DigitalAssetFormValues = {
  client_asset_id: '', category: 'other', relation: 'none', relation_id: '', notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function DigitalAssetsSection({ client, ctx, onChanged }: Props) {
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [files, setFiles] = useState<ClientAsset[]>([])
  const [websites, setWebsites] = useState<Website[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [listings, setListings] = useState<BusinessListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<DigitalAsset | null>(null)
  const [form, setForm] = useState<DG.DigitalAssetFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [confirmUnlink, setConfirmUnlink] = useState<DigitalAsset | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const filesCtx = { agencyId: ctx.agencyId, clientId: client.id, actorId: ctx.actorId, role: 'agency' as const }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [a, f, w, d, c, l] = await Promise.all([
        DG.listDigitalAssets(client.id),
        Files.listAgencyFiles(client.id),
        DG.listWebsites(client.id),
        DG.listDomains(client.id),
        DG.listSocialChannels(client.id),
        DG.listBusinessListings(client.id),
      ])
      setAssets(a); setFiles(f); setWebsites(w); setDomains(d); setChannels(c); setListings(l)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Digital Assets')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  const linkedFileIds = new Set(assets.map(a => a.client_asset_id))
  const availableFiles = files.filter(f => !linkedFileIds.has(f.id))

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(a: DigitalAsset) {
    setEditing(a)
    const [relation, relationId] = relationOf(a)
    setForm({ client_asset_id: a.client_asset_id, category: a.category, relation, relation_id: relationId, notes: a.notes ?? '' })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    setSaving(true); setFormErr(null)
    try {
      if (editing) await DG.updateDigitalAsset(editing.id, form)
      else await DG.createDigitalAsset(client.id, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save Digital Asset')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnlink(a: DigitalAsset) {
    setUnlinkingId(a.id); setError(null)
    try { await DG.deleteDigitalAsset(a.id); setConfirmUnlink(null); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to unlink Digital Asset') }
    finally { setUnlinkingId(null) }
  }

  const fileById = new Map(files.map(f => [f.id, f]))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Digital Assets</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Existing Files classified for digital use — favicons, app icons, social assets, and technical documents. Files themselves live in Files.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]" disabled={availableFiles.length === 0}>
          Link a File
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && assets.length === 0 && (
        <EmptyState
          title="No Digital Assets linked yet"
          description={files.length === 0
            ? 'This client has no Files uploaded yet. Upload a file in Files first, then link it here as a favicon, logo, or other digital asset.'
            : 'Link an existing File to classify it for digital use — a favicon, website image, or technical document.'}
          action={<Button variant="primary" size="sm" onClick={openCreate} disabled={files.length === 0}>Link a file</Button>}
        />
      )}

      {!loading && assets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assets.map(a => (
            <AssetCard
              key={a.id}
              asset={a}
              file={fileById.get(a.client_asset_id) ?? null}
              relationLabel={relationLabel(a, websites, domains, channels, listings)}
              onEdit={() => openEdit(a)}
              onUnlink={() => setConfirmUnlink(a)}
              onOpenFile={async f => { await Files.downloadFile(f, filesCtx) }}
            />
          ))}
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Digital Asset' : 'Link a File'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Link File'}</Button>
          </>
        }
      >
        <AssetForm
          form={form} setForm={setForm} formErr={formErr} isEdit={!!editing}
          availableFiles={editing ? files : availableFiles}
          editingFile={editing ? fileById.get(editing.client_asset_id) ?? null : null}
          websites={websites} domains={domains} channels={channels} listings={listings}
        />
      </DrawerPanel>

      {confirmUnlink && (
        <ConfirmModal
          title="Unlink Digital Asset?"
          body="This removes the Digital Asset reference only — the underlying file stays in Files, untouched."
          confirmLabel="Unlink"
          danger
          loading={unlinkingId === confirmUnlink.id}
          onCancel={() => setConfirmUnlink(null)}
          onConfirm={() => handleUnlink(confirmUnlink)}
        />
      )}
    </div>
  )
}

/* ── Relation helpers ─────────────────────────────────────── */

function relationOf(a: DigitalAsset): [DG.DigitalAssetRelation, string] {
  if (a.website_id) return ['website', a.website_id]
  if (a.domain_id) return ['domain', a.domain_id]
  if (a.social_channel_id) return ['social_channel', a.social_channel_id]
  if (a.business_listing_id) return ['business_listing', a.business_listing_id]
  return ['none', '']
}

function relationLabel(
  a: DigitalAsset, websites: Website[], domains: Domain[], channels: SocialChannel[], listings: BusinessListing[],
): string | null {
  if (a.website_id) return `Website · ${websites.find(w => w.id === a.website_id)?.name ?? 'Unknown'}`
  if (a.domain_id) return `Domain · ${domains.find(d => d.id === a.domain_id)?.domain_name ?? 'Unknown'}`
  if (a.social_channel_id) {
    const ch = channels.find(c => c.id === a.social_channel_id)
    return `Social · ${ch ? (ch.handle ?? DG.SOCIAL_PLATFORM_LABELS[ch.platform]) : 'Unknown'}`
  }
  if (a.business_listing_id) {
    const l = listings.find(x => x.id === a.business_listing_id)
    return `Listing · ${l ? (l.business_name ?? DG.LISTING_PROVIDER_LABELS[l.provider]) : 'Unknown'}`
  }
  return null
}

/* ── Form ─────────────────────────────────────────────────── */

function AssetForm({
  form, setForm, formErr, isEdit, availableFiles, editingFile, websites, domains, channels, listings,
}: {
  form: DG.DigitalAssetFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.DigitalAssetFormValues>>
  formErr: string | null
  isEdit: boolean
  availableFiles: ClientAsset[]
  editingFile: ClientAsset | null
  websites: Website[]
  domains: Domain[]
  channels: SocialChannel[]
  listings: BusinessListing[]
}) {
  const relationOptions: { value: DG.DigitalAssetRelation; label: string }[] = [
    { value: 'none', label: 'General purpose — no specific association' },
    { value: 'website', label: 'A website' },
    { value: 'domain', label: 'A domain' },
    { value: 'social_channel', label: 'A social channel' },
    { value: 'business_listing', label: 'A business listing' },
  ]
  const entityOptionsFor = (relation: DG.DigitalAssetRelation): { value: string; label: string }[] => {
    if (relation === 'website') return websites.map(w => ({ value: w.id, label: w.name }))
    if (relation === 'domain') return domains.map(d => ({ value: d.id, label: d.domain_name }))
    if (relation === 'social_channel') return channels.map(c => ({ value: c.id, label: c.handle ?? DG.SOCIAL_PLATFORM_LABELS[c.platform] }))
    if (relation === 'business_listing') return listings.map(l => ({ value: l.id, label: l.business_name ?? DG.LISTING_PROVIDER_LABELS[l.provider] }))
    return []
  }
  const entityOptions = entityOptionsFor(form.relation)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isEdit ? (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>File</p>
          <p style={{ fontSize: 13.5, color: 'var(--ink)' }}>{editingFile?.name ?? 'Unknown file'}</p>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>To link a different file, unlink this reference and link the new one.</p>
        </div>
      ) : (
        <Select
          label="File *"
          value={form.client_asset_id}
          onChange={e => setForm(f => ({ ...f, client_asset_id: e.target.value }))}
          options={[{ value: '', label: availableFiles.length === 0 ? 'No unlinked files available' : 'Choose a file…' }, ...availableFiles.map(f => ({ value: f.id, label: `${f.name} (${formatBytes(f.size_bytes)})` }))]}
        />
      )}
      <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as DG.DigitalAssetFormValues['category'] }))} options={DG.DIGITAL_ASSET_CATEGORY_OPTIONS} />
      <Select
        label="Associated with"
        value={form.relation}
        onChange={e => setForm(f => ({ ...f, relation: e.target.value as DG.DigitalAssetRelation, relation_id: '' }))}
        options={relationOptions}
      />
      {form.relation !== 'none' && (
        <Select
          label={`Which ${form.relation === 'social_channel' ? 'social channel' : form.relation === 'business_listing' ? 'listing' : form.relation}?`}
          value={form.relation_id}
          onChange={e => setForm(f => ({ ...f, relation_id: e.target.value }))}
          options={[{ value: '', label: entityOptions.length === 0 ? 'None on file' : 'Choose one…' }, ...entityOptions]}
        />
      )}
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────── */

function AssetCard({ asset, file, relationLabel, onEdit, onUnlink, onOpenFile }: {
  asset: DigitalAsset
  file: ClientAsset | null
  relationLabel: string | null
  onEdit: () => void
  onUnlink: () => void
  onOpenFile: (f: ClientAsset) => void
}) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{file?.name ?? 'File no longer available'}</p>
            <Badge variant="brand">{DG.DIGITAL_ASSET_CATEGORY_LABELS[asset.category]}</Badge>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            {relationLabel ?? 'General purpose'}{file ? ` · ${formatBytes(file.size_bytes)}` : ''}
          </p>
          {asset.notes && <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>{asset.notes}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap' }}>
        {file && <Button variant="outline" size="sm" onClick={() => onOpenFile(file)} className="min-h-[44px]">Open File</Button>}
        <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">Edit</Button>
        <Button variant="ghost" size="sm" onClick={onUnlink} style={{ color: 'var(--danger)', marginLeft: 'auto' }} className="min-h-[44px]">Unlink</Button>
      </div>
    </div>
  )
}
