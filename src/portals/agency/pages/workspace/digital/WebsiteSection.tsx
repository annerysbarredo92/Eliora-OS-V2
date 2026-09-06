import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Website, WebsiteStatus } from '@/types'

const STATUS_BADGE: Record<WebsiteStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  active: 'success',
  inactive: 'warning',
  archived: 'default',
}

const BLANK_FORM: DG.WebsiteFormValues = {
  name: '', url: '', website_type: 'primary_site', platform_cms: '', hosting_provider: '',
  status: 'active', ownership_status: 'unknown', launch_date: '', notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function WebsiteSection({ client, ctx, onChanged }: Props) {
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Website | null>(null)
  const [form, setForm] = useState<DG.WebsiteFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<Website | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setWebsites(await DG.listWebsites(client.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load websites') }
    finally { setLoading(false) }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(w: Website) {
    setEditing(w)
    setForm({
      name: w.name, url: w.url ?? '', website_type: w.website_type,
      platform_cms: w.platform_cms ?? '', hosting_provider: w.hosting_provider ?? '',
      status: w.status, ownership_status: w.ownership_status,
      launch_date: w.launch_date ?? '', notes: w.notes ?? '',
    })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setFormErr('Website name is required'); return }
    if (!DG.isValidUrl(form.url)) { setFormErr('Enter a valid website URL'); return }
    setSaving(true); setFormErr(null)
    try {
      if (editing) await DG.updateWebsite(editing.id, form, ctx)
      else await DG.createWebsite(client.id, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save website')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetPrimary(w: Website) {
    setSettingPrimaryId(w.id); setError(null)
    try { await DG.setPrimaryWebsite(w.id, ctx.actorId); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to set primary website') }
    finally { setSettingPrimaryId(null) }
  }

  async function handleArchive(w: Website) {
    setArchivingId(w.id); setError(null)
    try { await DG.archiveWebsite(w, ctx); setConfirmArchive(null); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to archive website') }
    finally { setArchivingId(null) }
  }

  const current = websites.filter(w => w.status !== 'archived')
  const archived = websites.filter(w => w.status === 'archived')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Website</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>This client's owned websites. One may be marked primary.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">New Website</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && websites.length === 0 && (
        <EmptyState
          title="No websites yet"
          description="Add this client's website to start tracking their digital presence — the first one you add becomes primary automatically."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Add first website</Button>}
        />
      )}

      {!loading && current.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: archived.length > 0 ? 28 : 0 }}>
          {current.map(w => (
            <WebsiteCard
              key={w.id}
              website={w}
              settingPrimary={settingPrimaryId === w.id}
              onEdit={() => openEdit(w)}
              onSetPrimary={!w.is_primary ? () => handleSetPrimary(w) : undefined}
              onArchive={() => {
                // Checked here, before opening the confirm dialog, so the
                // message is actually visible — surfacing it only from
                // inside handleArchive's catch would land behind the
                // still-open confirm modal.
                if (w.is_primary) { setError('This is the primary website. Set another website as primary before archiving it.'); return }
                setConfirmArchive(w)
              }}
            />
          ))}
        </div>
      )}

      {!loading && archived.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
            Archived
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {archived.map(w => (
              <WebsiteCard key={w.id} website={w} onEdit={() => openEdit(w)} />
            ))}
          </div>
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Website' : 'New Website'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Create Website'}</Button>
          </>
        }
      >
        <WebsiteForm form={form} setForm={setForm} formErr={formErr} isEdit={!!editing} />
      </DrawerPanel>

      {confirmArchive && (
        <ConfirmModal
          title="Archive website?"
          body={`"${confirmArchive.name}" will be archived. It stays on record but no longer counts toward active presence.`}
          confirmLabel="Archive"
          danger
          loading={archivingId === confirmArchive.id}
          onCancel={() => setConfirmArchive(null)}
          onConfirm={() => handleArchive(confirmArchive)}
        />
      )}
    </div>
  )
}

/* ── Form ─────────────────────────────────────────────────── */

function WebsiteForm({ form, setForm, formErr, isEdit }: {
  form: DG.WebsiteFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.WebsiteFormValues>>
  formErr: string | null
  isEdit: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input label="Website name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Main company site" />
      <Input label="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="example.com" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Type" value={form.website_type} onChange={e => setForm(f => ({ ...f, website_type: e.target.value as DG.WebsiteFormValues['website_type'] }))} options={DG.WEBSITE_TYPE_OPTIONS} />
        {isEdit && <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DG.WebsiteFormValues['status'] }))} options={DG.WEBSITE_STATUS_OPTIONS} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Platform / CMS" value={form.platform_cms} onChange={e => setForm(f => ({ ...f, platform_cms: e.target.value }))} placeholder="e.g. WordPress" />
        <Input label="Hosting provider" value={form.hosting_provider} onChange={e => setForm(f => ({ ...f, hosting_provider: e.target.value }))} placeholder="e.g. WP Engine" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Ownership / access" value={form.ownership_status} onChange={e => setForm(f => ({ ...f, ownership_status: e.target.value as DG.WebsiteFormValues['ownership_status'] }))} options={DG.OWNERSHIP_STATUS_OPTIONS} />
        <Input label="Launch date" type="date" value={form.launch_date} onChange={e => setForm(f => ({ ...f, launch_date: e.target.value }))} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      {!isEdit && (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>If this is the client's first website, it becomes primary automatically.</p>
      )}
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────── */

function WebsiteCard({ website, settingPrimary, onEdit, onSetPrimary, onArchive }: {
  website: Website
  settingPrimary?: boolean
  onEdit: () => void
  onSetPrimary?: () => void
  onArchive?: () => void
}) {
  const isArchived = website.status === 'archived'
  return (
    <div style={{
      background: 'var(--surface-solid)',
      border: `1px solid ${website.is_primary ? 'var(--violet)' : isArchived ? 'var(--hairline-2)' : 'var(--hairline)'}`,
      borderRadius: 'var(--radius)', padding: '14px 16px', opacity: isArchived ? 0.72 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{website.name}</p>
            {website.is_primary && <Badge variant="brand">Primary</Badge>}
            <Badge variant={STATUS_BADGE[website.status]}>{DG.WEBSITE_STATUS_LABELS[website.status]}</Badge>
          </div>
          {website.url && (
            <a href={DG.normalizeUrl(website.url)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--violet)', textDecoration: 'none' }}>
              {website.url}
            </a>
          )}
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {[DG.WEBSITE_TYPE_LABELS[website.website_type], website.platform_cms, website.hosting_provider].filter(Boolean).join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{DG.OWNERSHIP_STATUS_LABELS[website.ownership_status]}</span>
            {website.launch_date && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Launched {new Date(website.launch_date).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">Edit</Button>
        {onSetPrimary && <Button variant="ghost" size="sm" onClick={onSetPrimary} loading={settingPrimary} className="min-h-[44px]">Set Primary</Button>}
        {onArchive && <Button variant="ghost" size="sm" onClick={onArchive} style={{ color: 'var(--danger)', marginLeft: 'auto' }} className="min-h-[44px]">Archive</Button>}
      </div>
    </div>
  )
}

/* ── Shared small helpers (local — see RetainersSection.tsx for precedent) ── */

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-solid))', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 14 }}>
      <p style={{ fontSize: 13.5, color: 'var(--danger)' }}>{message}</p>
    </div>
  )
}

export function Skel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1].map(i => <div key={i} style={{ height: 100, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.5 }} />)}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{description}</p>
      {action}
    </div>
  )
}

export function ConfirmModal({ title, body, confirmLabel, danger, loading, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string; danger?: boolean
  loading: boolean; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div role="presentation" onMouseDown={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,20,48,0.4)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ background: 'var(--surface-solid)', borderRadius: 'var(--radius)', padding: 28, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-glass)' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={onConfirm} style={danger ? { background: 'var(--danger)' } : undefined}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
