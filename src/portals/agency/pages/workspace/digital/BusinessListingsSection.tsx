import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import { ErrorBanner, Skel, EmptyState, ConfirmModal } from './WebsiteSection'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { BusinessListing, ListingStatus, DigitalVerificationStatus } from '@/types'

const STATUS_BADGE: Record<ListingStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  active: 'success', inactive: 'warning', archived: 'default',
}
const VERIFICATION_BADGE: Record<DigitalVerificationStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  verified: 'success', unverified: 'warning', pending: 'brand', not_applicable: 'default',
}

const BLANK_FORM: DG.BusinessListingFormValues = {
  provider: 'google_business_profile', custom_provider_name: '', business_name: '', address: '', phone: '',
  profile_url: '', external_listing_id: '', verification_status: 'unverified', ownership_status: 'unknown',
  listing_status: 'active', category: '', rating: '', review_count: '', last_review_at: '', notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function BusinessListingsSection({ client, ctx, onChanged }: Props) {
  const [listings, setListings] = useState<BusinessListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<BusinessListing | null>(null)
  const [form, setForm] = useState<DG.BusinessListingFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<BusinessListing | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setListings(await DG.listBusinessListings(client.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load listings') }
    finally { setLoading(false) }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null); setForm(BLANK_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEdit(l: BusinessListing) {
    setEditing(l)
    setForm({
      provider: l.provider, custom_provider_name: l.custom_provider_name ?? '',
      business_name: l.business_name ?? '', address: l.address ?? '', phone: l.phone ?? '',
      profile_url: l.profile_url ?? '', external_listing_id: l.external_listing_id ?? '',
      verification_status: l.verification_status, ownership_status: l.ownership_status,
      listing_status: l.listing_status, category: l.category ?? '',
      rating: l.rating != null ? String(l.rating) : '', review_count: String(l.review_count ?? 0),
      last_review_at: l.last_review_at ? l.last_review_at.slice(0, 10) : '', notes: l.notes ?? '',
    })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    if (form.provider === 'custom' && !form.custom_provider_name.trim()) { setFormErr('Enter a name for this custom provider'); return }
    if (!DG.isValidUrl(form.profile_url)) { setFormErr('Enter a valid profile URL'); return }
    if (form.rating.trim() && (Number(form.rating) < 0 || Number(form.rating) > 5 || Number.isNaN(Number(form.rating)))) { setFormErr('Rating must be between 0 and 5'); return }
    if (form.review_count.trim() && (Number.isNaN(Number(form.review_count)) || Number(form.review_count) < 0)) { setFormErr('Review count must be zero or more'); return }
    setSaving(true); setFormErr(null)
    try {
      if (editing) await DG.updateBusinessListing(editing.id, form, ctx)
      else await DG.createBusinessListing(client.id, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save listing')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(l: BusinessListing) {
    setArchivingId(l.id); setError(null)
    try { await DG.archiveBusinessListing(l, ctx); setConfirmArchive(null); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to archive listing') }
    finally { setArchivingId(null) }
  }

  const current = listings.filter(l => l.listing_status !== 'archived')
  const archived = listings.filter(l => l.listing_status === 'archived')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Business Listings</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Where this client appears in public directories — multiple listings per provider are expected for multi-location businesses.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">New Listing</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && listings.length === 0 && (
        <EmptyState
          title="No business listings yet"
          description="Track this client's presence on Google Business Profile, Apple Business Connect, Bing Places, Yelp, or any custom directory — one listing per real-world location."
          action={<Button variant="primary" size="sm" onClick={openCreate}>Add first listing</Button>}
        />
      )}

      {!loading && current.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: archived.length > 0 ? 28 : 0 }}>
          {current.map(l => (
            <ListingCard key={l.id} listing={l} onEdit={() => openEdit(l)} onArchive={() => setConfirmArchive(l)} />
          ))}
        </div>
      )}

      {!loading && archived.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Archived</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {archived.map(l => <ListingCard key={l.id} listing={l} onEdit={() => openEdit(l)} />)}
          </div>
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={editing ? 'Edit Listing' : 'New Listing'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Create Listing'}</Button>
          </>
        }
      >
        <ListingForm form={form} setForm={setForm} formErr={formErr} />
      </DrawerPanel>

      {confirmArchive && (
        <ConfirmModal
          title="Archive listing?"
          body={`This listing (${DG.LISTING_PROVIDER_LABELS[confirmArchive.provider]}${confirmArchive.business_name ? ` — ${confirmArchive.business_name}` : ''}) will be archived.`}
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

function ListingForm({ form, setForm, formErr }: {
  form: DG.BusinessListingFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.BusinessListingFormValues>>
  formErr: string | null
}) {
  const isCustom = form.provider === 'custom'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Select label="Provider *" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value as DG.BusinessListingFormValues['provider'] }))} options={DG.LISTING_PROVIDER_OPTIONS} />
      {isCustom && (
        <Input label="Custom provider name *" value={form.custom_provider_name} onChange={e => setForm(f => ({ ...f, custom_provider_name: e.target.value }))} placeholder="e.g. TripAdvisor" />
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8 }}>
        Multiple listings from the same provider are expected — use business/location name and address below to tell locations apart.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Business / location name" value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="e.g. Downtown location" />
        <Input label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Restaurant" />
      </div>
      <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, city, state" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 555-5555" />
        <Input label="Profile URL" value={form.profile_url} onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))} placeholder="https://…" />
      </div>
      <Input label="External listing ID" value={form.external_listing_id} onChange={e => setForm(f => ({ ...f, external_listing_id: e.target.value }))} placeholder="Optional — leave blank for manual entries" hint="If entered, this exact provider + ID combination must be unique for this client." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Verification" value={form.verification_status} onChange={e => setForm(f => ({ ...f, verification_status: e.target.value as DG.BusinessListingFormValues['verification_status'] }))} options={DG.VERIFICATION_STATUS_OPTIONS} />
        <Select label="Ownership / access" value={form.ownership_status} onChange={e => setForm(f => ({ ...f, ownership_status: e.target.value as DG.BusinessListingFormValues['ownership_status'] }))} options={DG.OWNERSHIP_STATUS_OPTIONS} />
      </div>
      <Select label="Status" value={form.listing_status} onChange={e => setForm(f => ({ ...f, listing_status: e.target.value as DG.BusinessListingFormValues['listing_status'] }))} options={DG.LISTING_STATUS_OPTIONS} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Input label="Rating (0-5)" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} inputMode="decimal" placeholder="4.5" />
        <Input label="Review count" value={form.review_count} onChange={e => setForm(f => ({ ...f, review_count: e.target.value }))} inputMode="numeric" placeholder="0" />
        <Input label="Last review" type="date" value={form.last_review_at} onChange={e => setForm(f => ({ ...f, last_review_at: e.target.value }))} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────── */

function ListingCard({ listing, onEdit, onArchive }: {
  listing: BusinessListing
  onEdit: () => void
  onArchive?: () => void
}) {
  const isArchived = listing.listing_status === 'archived'
  const providerLabel = listing.provider === 'custom' ? (listing.custom_provider_name ?? 'Custom') : DG.LISTING_PROVIDER_LABELS[listing.provider]

  return (
    <div style={{ background: 'var(--surface-solid)', border: `1px solid ${isArchived ? 'var(--hairline-2)' : 'var(--hairline)'}`, borderRadius: 'var(--radius)', padding: '14px 16px', opacity: isArchived ? 0.72 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{providerLabel}{listing.business_name ? ` — ${listing.business_name}` : ''}</p>
            <Badge variant={VERIFICATION_BADGE[listing.verification_status]}>{DG.VERIFICATION_STATUS_LABELS[listing.verification_status]}</Badge>
            <Badge variant={STATUS_BADGE[listing.listing_status]}>{DG.LISTING_STATUS_LABELS[listing.listing_status]}</Badge>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            {[listing.address, listing.phone].filter(Boolean).join(' · ') || 'No address/phone on file'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {listing.profile_url && (
              <a href={DG.normalizeUrl(listing.profile_url)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--violet)', textDecoration: 'none' }}>View profile ↗</a>
            )}
            {listing.rating != null && (
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>★ {listing.rating.toFixed(1)} ({listing.review_count})</span>
            )}
            {!listing.profile_url && listing.review_count === 0 && listing.rating == null && (
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{DG.OWNERSHIP_STATUS_LABELS[listing.ownership_status]}</span>
            )}
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
