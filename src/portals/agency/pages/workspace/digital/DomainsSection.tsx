import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import { ErrorBanner, Skel, EmptyState, ConfirmModal } from './WebsiteSection'
import { domainExpirationState, DOMAIN_EXPIRATION_LABEL, domainDaysUntilExpiration } from './domainExpiration'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Domain, DomainStatus, Website } from '@/types'

const STATUS_BADGE: Record<DomainStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  active: 'success', expired: 'danger', transferring: 'warning', archived: 'default',
}

const EXPIRATION_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  expired: 'danger', expiring_soon: 'warning', upcoming: 'brand', healthy: 'success', unknown: 'default',
}

const BLANK_FORM: DG.DomainFormValues = {
  domain_name: '', website_id: '', registrar: '', dns_provider: '',
  registration_date: '', expiration_date: '', auto_renew: false,
  ssl_status: 'unknown', ssl_expiration_date: '', status: 'active', notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function DomainsSection({ client, ctx, onChanged }: Props) {
  const [domains, setDomains] = useState<Domain[]>([])
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Domain | null>(null)
  const [form, setForm] = useState<DG.DomainFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<Domain | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [d, w] = await Promise.all([DG.listDomains(client.id), DG.listWebsites(client.id)])
      setDomains(d); setWebsites(w)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load domains')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(d: Domain) {
    setEditing(d)
    setForm({
      domain_name: d.domain_name, website_id: d.website_id ?? '',
      registrar: d.registrar ?? '', dns_provider: d.dns_provider ?? '',
      registration_date: d.registration_date ?? '', expiration_date: d.expiration_date ?? '',
      auto_renew: d.auto_renew, ssl_status: d.ssl_status, ssl_expiration_date: d.ssl_expiration_date ?? '',
      status: d.status, notes: d.notes ?? '',
    })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    if (!DG.isValidDomainName(form.domain_name)) { setFormErr('Enter a valid domain, e.g. example.com'); return }
    setSaving(true); setFormErr(null)
    try {
      if (editing) await DG.updateDomain(editing.id, form, ctx)
      else await DG.createDomain(client.id, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save domain')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(d: Domain) {
    setArchivingId(d.id); setError(null)
    try { await DG.archiveDomain(d, ctx); setConfirmArchive(null); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to archive domain') }
    finally { setArchivingId(null) }
  }

  const websiteName = (id: string | null) => id ? websites.find(w => w.id === id)?.name ?? '—' : null
  const current = domains.filter(d => d.status !== 'archived')
  const archived = domains.filter(d => d.status === 'archived')
  const websiteOptions = [{ value: '', label: 'None' }, ...websites.filter(w => w.status !== 'archived').map(w => ({ value: w.id, label: w.name }))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Domains</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Domain infrastructure this client owns — not a DNS control panel.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">New Domain</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && domains.length === 0 && (
        <EmptyState
          title="No domains yet"
          description="Add a domain to track registrar, DNS, renewal, and SSL status for this client."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Add first domain</Button>}
        />
      )}

      {!loading && current.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: archived.length > 0 ? 28 : 0 }}>
          {current.map(d => (
            <DomainCard key={d.id} domain={d} websiteName={websiteName(d.website_id)} onEdit={() => openEdit(d)} onArchive={() => setConfirmArchive(d)} />
          ))}
        </div>
      )}

      {!loading && archived.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Archived</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {archived.map(d => (
              <DomainCard key={d.id} domain={d} websiteName={websiteName(d.website_id)} onEdit={() => openEdit(d)} />
            ))}
          </div>
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Domain' : 'New Domain'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Create Domain'}</Button>
          </>
        }
      >
        <DomainForm form={form} setForm={setForm} formErr={formErr} websiteOptions={websiteOptions} />
      </DrawerPanel>

      {confirmArchive && (
        <ConfirmModal
          title="Archive domain?"
          body={`"${confirmArchive.domain_name}" will be archived and no longer counted as active.`}
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

function DomainForm({ form, setForm, formErr, websiteOptions }: {
  form: DG.DomainFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.DomainFormValues>>
  formErr: string | null
  websiteOptions: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input label="Domain *" value={form.domain_name} onChange={e => setForm(f => ({ ...f, domain_name: e.target.value }))} placeholder="example.com" />
      <Select label="Linked website" value={form.website_id} onChange={e => setForm(f => ({ ...f, website_id: e.target.value }))} options={websiteOptions} hint="Only this client's own websites are shown." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Registrar" value={form.registrar} onChange={e => setForm(f => ({ ...f, registrar: e.target.value }))} placeholder="e.g. GoDaddy" />
        <Input label="DNS provider" value={form.dns_provider} onChange={e => setForm(f => ({ ...f, dns_provider: e.target.value }))} placeholder="e.g. Cloudflare" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Registration date" type="date" value={form.registration_date} onChange={e => setForm(f => ({ ...f, registration_date: e.target.value }))} />
        <Input label="Expiration date" type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.auto_renew} onChange={e => setForm(f => ({ ...f, auto_renew: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--violet)' }} />
        <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>Auto-renew</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="SSL status" value={form.ssl_status} onChange={e => setForm(f => ({ ...f, ssl_status: e.target.value as DG.DomainFormValues['ssl_status'] }))} options={DG.SSL_STATUS_OPTIONS} />
        <Input label="SSL expiration" type="date" value={form.ssl_expiration_date} onChange={e => setForm(f => ({ ...f, ssl_expiration_date: e.target.value }))} />
      </div>
      <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DG.DomainFormValues['status'] }))} options={DG.DOMAIN_STATUS_OPTIONS} />
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────── */

function DomainCard({ domain, websiteName, onEdit, onArchive }: {
  domain: Domain
  websiteName: string | null
  onEdit: () => void
  onArchive?: () => void
}) {
  const isArchived = domain.status === 'archived'
  const expiration = domainExpirationState(domain)
  const days = domainDaysUntilExpiration(domain)

  return (
    <div style={{ background: 'var(--surface-solid)', border: `1px solid ${isArchived ? 'var(--hairline-2)' : 'var(--hairline)'}`, borderRadius: 'var(--radius)', padding: '14px 16px', opacity: isArchived ? 0.72 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{domain.domain_name}</p>
            <Badge variant={STATUS_BADGE[domain.status]}>{DG.DOMAIN_STATUS_LABELS[domain.status]}</Badge>
            {!isArchived && (
              <Badge variant={EXPIRATION_BADGE[expiration]}>
                {DOMAIN_EXPIRATION_LABEL[expiration]}{days !== null && expiration !== 'healthy' ? ` · ${days < 0 ? `${-days}d ago` : `${days}d`}` : ''}
              </Badge>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            {[websiteName, domain.registrar, domain.dns_provider].filter(Boolean).join(' · ') || 'No registrar/DNS on file'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: domain.ssl_status === 'invalid' || domain.ssl_status === 'none' ? 'var(--danger)' : 'var(--muted)' }}>
              SSL: {DG.SSL_STATUS_LABELS[domain.ssl_status]}
            </span>
            {domain.auto_renew && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Auto-renew on</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)', flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">Edit</Button>
        {onArchive && <Button variant="ghost" size="sm" onClick={onArchive} style={{ color: 'var(--danger)', marginLeft: 'auto' }} className="min-h-[44px]">Archive</Button>}
      </div>
    </div>
  )
}
