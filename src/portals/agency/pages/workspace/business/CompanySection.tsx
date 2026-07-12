import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { updateCompanyInfo, updateDiscoveryData } from '@/features/clients/api'
import type { Client } from '@/types'

/* ── Constants ───────────────────────────────────────────── */

const SOCIAL_PLATFORMS = [
  { id: 'instagram',       label: 'Instagram',       placeholder: 'https://instagram.com/yourbrand' },
  { id: 'facebook',        label: 'Facebook',        placeholder: 'https://facebook.com/yourbrand' },
  { id: 'linkedin',        label: 'LinkedIn',        placeholder: 'https://linkedin.com/company/yourbrand' },
  { id: 'tiktok',          label: 'TikTok',          placeholder: 'https://tiktok.com/@yourbrand' },
  { id: 'youtube',         label: 'YouTube',         placeholder: 'https://youtube.com/@yourbrand' },
  { id: 'twitter',         label: 'X (Twitter)',     placeholder: 'https://x.com/yourbrand' },
  { id: 'pinterest',       label: 'Pinterest',       placeholder: 'https://pinterest.com/yourbrand' },
  { id: 'google_business', label: 'Google Business', placeholder: 'https://g.page/yourbrand' },
]

const BUSINESS_MODELS = [
  { value: '',            label: 'Select…' },
  { value: 'b2b',         label: 'B2B' },
  { value: 'b2c',         label: 'B2C' },
  { value: 'b2b2c',       label: 'B2B2C' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'saas',        label: 'SaaS' },
  { value: 'ecommerce',   label: 'E-commerce' },
  { value: 'service',     label: 'Service Business' },
  { value: 'other',       label: 'Other' },
]

const EMPLOYEE_RANGES = [
  { value: '',       label: 'Select…' },
  { value: '1-5',    label: '1–5' },
  { value: '6-10',   label: '6–10' },
  { value: '11-25',  label: '11–25' },
  { value: '26-50',  label: '26–50' },
  { value: '51-100', label: '51–100' },
  { value: '101-250',label: '101–250' },
  { value: '251-500',label: '251–500' },
  { value: '500+',   label: '500+' },
]

const TIMEZONES = [
  { value: '',                    label: 'Select…' },
  { value: 'America/New_York',    label: 'Eastern Time (ET)' },
  { value: 'America/Chicago',     label: 'Central Time (CT)' },
  { value: 'America/Denver',      label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)' },
  { value: 'Europe/London',       label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',        label: 'Central European (CET)' },
  { value: 'Europe/Istanbul',     label: 'Istanbul (TRT)' },
  { value: 'Asia/Dubai',          label: 'Gulf Standard (GST)' },
  { value: 'Asia/Kolkata',        label: 'India (IST)' },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo',          label: 'Japan (JST)' },
  { value: 'Australia/Sydney',    label: 'Australia Eastern (AEST)' },
  { value: 'Pacific/Auckland',    label: 'New Zealand (NZST)' },
]

/* ── Types ───────────────────────────────────────────────── */

type EditingCard = 'company' | 'business' | 'social' | null

interface CompanyFormValues {
  business_name: string
  industry: string
  sub_industry: string
  website: string
  business_email: string
  business_phone: string
  business_address: string
  location: string
  timezone: string
  business_hours: string
}

interface BusinessFormValues {
  company_description: string
  founded_year: string
  employee_count: string
  business_model: string
  geographic_reach: string
  service_area: string
  target_audience: string
  primary_services: string
  avg_customer_value: string
}

type SocialForm = Record<string, string>

/* ── Form builders ───────────────────────────────────────── */

function buildCompanyForm(c: Client): CompanyFormValues {
  const d = (c.discovery_data ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '')
  return {
    business_name:    c.business_name ?? '',
    industry:         c.industry ?? '',
    sub_industry:     c.sub_industry ?? '',
    website:          c.website ?? '',
    business_email:   c.business_email ?? '',
    business_phone:   c.business_phone ?? '',
    business_address: c.business_address ?? '',
    location:         c.location ?? '',
    timezone:         c.timezone ?? '',
    business_hours:   str('business_hours'),
  }
}

function buildBusinessForm(c: Client): BusinessFormValues {
  const d = (c.discovery_data ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '')
  return {
    company_description: c.company_description ?? '',
    founded_year:        str('founded_year'),
    employee_count:      str('employee_count'),
    business_model:      str('business_model'),
    geographic_reach:    str('geographic_reach'),
    service_area:        str('service_area'),
    target_audience:     str('target_audience'),
    primary_services:    str('primary_services'),
    avg_customer_value:  str('avg_customer_value'),
  }
}

function buildSocialForm(c: Client): SocialForm {
  const social = ((c.discovery_data ?? {}) as Record<string, unknown>).social_urls
  const stored = (typeof social === 'object' && social !== null ? social : {}) as Record<string, string>
  return Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.id, stored[p.id] ?? '']))
}

/* ── Main component ──────────────────────────────────────── */

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function CompanySection({ client, ctx, onChanged }: Props) {
  const [editingCard, setEditingCard] = useState<EditingCard>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [companyForm,  setCompanyForm]  = useState<CompanyFormValues>(buildCompanyForm(client))
  const [businessForm, setBusinessForm] = useState<BusinessFormValues>(buildBusinessForm(client))
  const [socialForm,   setSocialForm]   = useState<SocialForm>(buildSocialForm(client))

  function tryEdit(card: EditingCard) {
    // Silently discard the in-progress edit and revert to saved values before
    // opening another card. No native dialog — inline edits are low-stakes.
    setSaveError(null)
    if (card === 'company')  setCompanyForm(buildCompanyForm(client))
    if (card === 'business') setBusinessForm(buildBusinessForm(client))
    if (card === 'social')   setSocialForm(buildSocialForm(client))
    setEditingCard(card)
  }

  function cancelEdit() {
    setEditingCard(null)
    setSaveError(null)
  }

  async function saveCompany() {
    if (!companyForm.business_name.trim()) { setSaveError('Business name is required'); return }
    setSaving(true); setSaveError(null)
    try {
      await updateCompanyInfo(client.id, {
        business_name:    companyForm.business_name.trim(),
        industry:         companyForm.industry.trim() || null,
        sub_industry:     companyForm.sub_industry.trim() || null,
        website:          companyForm.website.trim() || null,
        business_email:   companyForm.business_email.trim() || null,
        business_phone:   companyForm.business_phone.trim() || null,
        business_address: companyForm.business_address.trim() || null,
        location:         companyForm.location.trim() || null,
        timezone:         companyForm.timezone || null,
      }, ctx)
      if (companyForm.business_hours.trim()) {
        await updateDiscoveryData(client.id, { business_hours: companyForm.business_hours.trim() }, ctx)
      } else {
        await updateDiscoveryData(client.id, { business_hours: null }, ctx)
      }
      setEditingCard(null)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function saveBusiness() {
    setSaving(true); setSaveError(null)
    try {
      await updateCompanyInfo(client.id, {
        company_description: businessForm.company_description.trim() || null,
      }, ctx)
      await updateDiscoveryData(client.id, {
        founded_year:       businessForm.founded_year.trim() || null,
        employee_count:     businessForm.employee_count || null,
        business_model:     businessForm.business_model || null,
        geographic_reach:   businessForm.geographic_reach.trim() || null,
        service_area:       businessForm.service_area.trim() || null,
        target_audience:    businessForm.target_audience.trim() || null,
        primary_services:   businessForm.primary_services.trim() || null,
        avg_customer_value: businessForm.avg_customer_value.trim() || null,
      }, ctx)
      setEditingCard(null)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function saveSocial() {
    setSaving(true); setSaveError(null)
    try {
      await updateDiscoveryData(client.id, { social_urls: socialForm }, ctx)
      setEditingCard(null)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  // Derived display values
  const dv = (key: string): string | null => {
    const v = (client.discovery_data ?? {})[key]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const socialStored = ((client.discovery_data ?? {}) as Record<string, unknown>).social_urls
  const social = (typeof socialStored === 'object' && socialStored !== null
    ? socialStored : {}) as Record<string, string>
  const hasSocial = SOCIAL_PLATFORMS.some(p => social[p.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Company Information ───────────────────────────────── */}
      <InlineCard
        title="Company Information"
        editing={editingCard === 'company'}
        onEdit={() => tryEdit('company')}
        onCancel={cancelEdit}
        onSave={saveCompany}
        saving={saving}
        saveError={editingCard === 'company' ? saveError : null}
      >
        {editingCard === 'company' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label="Business Name *"
                value={companyForm.business_name}
                onChange={e => setCompanyForm(f => ({ ...f, business_name: e.target.value }))}
                placeholder="Acme Corp"
              />
              <Input
                label="Industry"
                value={companyForm.industry}
                onChange={e => setCompanyForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="Marketing, Retail, Tech…"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label="Sub-Industry"
                value={companyForm.sub_industry}
                onChange={e => setCompanyForm(f => ({ ...f, sub_industry: e.target.value }))}
                placeholder="SaaS, Luxury Retail…"
              />
              <Input
                label="Website"
                value={companyForm.website}
                onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label="Business Email"
                type="email"
                value={companyForm.business_email}
                onChange={e => setCompanyForm(f => ({ ...f, business_email: e.target.value }))}
                placeholder="hello@company.com"
              />
              <Input
                label="Phone"
                value={companyForm.business_phone}
                onChange={e => setCompanyForm(f => ({ ...f, business_phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <Input
              label="Address"
              value={companyForm.business_address}
              onChange={e => setCompanyForm(f => ({ ...f, business_address: e.target.value }))}
              placeholder="123 Main St, New York, NY 10001"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label="Location / City"
                value={companyForm.location}
                onChange={e => setCompanyForm(f => ({ ...f, location: e.target.value }))}
                placeholder="New York, US"
              />
              <Select
                label="Timezone"
                value={companyForm.timezone}
                onChange={e => setCompanyForm(f => ({ ...f, timezone: e.target.value }))}
                options={TIMEZONES}
              />
            </div>
            <Input
              label="Business Hours"
              value={companyForm.business_hours}
              onChange={e => setCompanyForm(f => ({ ...f, business_hours: e.target.value }))}
              placeholder="Mon–Fri 9am–5pm ET"
            />
          </div>
        ) : (
          <FieldGrid>
            <Field label="Business Name" value={client.business_name} />
            <Field label="Industry"      value={client.industry} />
            <Field label="Sub-Industry"  value={client.sub_industry} />
            <Field label="Website"       value={client.website} link />
            <Field label="Business Email" value={client.business_email} />
            <Field label="Phone"         value={client.business_phone} />
            <Field label="Address"       value={client.business_address} full />
            <Field label="Location"      value={client.location} />
            <Field label="Timezone"      value={client.timezone} />
            <Field label="Business Hours" value={dv('business_hours')} full />
          </FieldGrid>
        )}
      </InlineCard>

      {/* ── Business Details ──────────────────────────────────── */}
      <InlineCard
        title="Business Details"
        editing={editingCard === 'business'}
        onEdit={() => tryEdit('business')}
        onCancel={cancelEdit}
        onSave={saveBusiness}
        saving={saving}
        saveError={editingCard === 'business' ? saveError : null}
      >
        {editingCard === 'business' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Textarea
              label="Company Description"
              rows={4}
              value={businessForm.company_description}
              onChange={e => setBusinessForm(f => ({ ...f, company_description: e.target.value }))}
              placeholder="A brief description of what this company does…"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label="Founded Year"
                type="number"
                min={1800}
                max={new Date().getFullYear()}
                value={businessForm.founded_year}
                onChange={e => setBusinessForm(f => ({ ...f, founded_year: e.target.value }))}
                placeholder="e.g. 2015"
              />
              <Select
                label="Employee Count"
                value={businessForm.employee_count}
                onChange={e => setBusinessForm(f => ({ ...f, employee_count: e.target.value }))}
                options={EMPLOYEE_RANGES}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Select
                label="Business Model"
                value={businessForm.business_model}
                onChange={e => setBusinessForm(f => ({ ...f, business_model: e.target.value }))}
                options={BUSINESS_MODELS}
              />
              <Input
                label="Avg. Customer Value"
                value={businessForm.avg_customer_value}
                onChange={e => setBusinessForm(f => ({ ...f, avg_customer_value: e.target.value }))}
                placeholder="e.g. $5,000/yr"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label="Geographic Reach"
                value={businessForm.geographic_reach}
                onChange={e => setBusinessForm(f => ({ ...f, geographic_reach: e.target.value }))}
                placeholder="North America, Global…"
              />
              <Input
                label="Service Area"
                value={businessForm.service_area}
                onChange={e => setBusinessForm(f => ({ ...f, service_area: e.target.value }))}
                placeholder="New York Metro, Online…"
              />
            </div>
            <Textarea
              label="Target Audience"
              rows={3}
              value={businessForm.target_audience}
              onChange={e => setBusinessForm(f => ({ ...f, target_audience: e.target.value }))}
              placeholder="Who are their customers?"
            />
            <Textarea
              label="Primary Services / Products"
              rows={3}
              value={businessForm.primary_services}
              onChange={e => setBusinessForm(f => ({ ...f, primary_services: e.target.value }))}
              placeholder="Main products or services they offer…"
            />
          </div>
        ) : (
          <div>
            {client.company_description && (
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>
                {client.company_description}
              </p>
            )}
            <FieldGrid>
              <Field label="Founded"           value={dv('founded_year')} />
              <Field label="Employees"         value={dv('employee_count')} />
              <Field label="Business Model"    value={dv('business_model')} />
              <Field label="Avg. Customer Value" value={dv('avg_customer_value')} />
              <Field label="Geographic Reach"  value={dv('geographic_reach')} />
              <Field label="Service Area"      value={dv('service_area')} />
              <Field label="Target Audience"   value={dv('target_audience')} full />
              <Field label="Primary Services"  value={dv('primary_services')} full />
            </FieldGrid>
            {!client.company_description && !['founded_year','employee_count','business_model',
              'geographic_reach','service_area','target_audience','primary_services','avg_customer_value']
              .some(k => dv(k)) && (
              <Empty>No business details added yet.</Empty>
            )}
          </div>
        )}
      </InlineCard>

      {/* ── Social Presence ───────────────────────────────────── */}
      <InlineCard
        title="Social Presence"
        editing={editingCard === 'social'}
        onEdit={() => tryEdit('social')}
        onCancel={cancelEdit}
        onSave={saveSocial}
        saving={saving}
        saveError={editingCard === 'social' ? saveError : null}
        editLabel="Edit profiles"
      >
        {editingCard === 'social' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              Add profile URLs for each platform. Leave blank to remove.
            </p>
            {SOCIAL_PLATFORMS.map(p => (
              <Input
                key={p.id}
                label={p.label}
                value={socialForm[p.id] ?? ''}
                onChange={e => setSocialForm(f => ({ ...f, [p.id]: e.target.value }))}
                placeholder={p.placeholder}
              />
            ))}
          </div>
        ) : !hasSocial ? (
          <Empty>No social profiles added yet.</Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {SOCIAL_PLATFORMS.filter(p => social[p.id]).map(p => (
              <SocialRow key={p.id} label={p.label} url={social[p.id]} />
            ))}
          </div>
        )}
      </InlineCard>

    </div>
  )
}

/* ── Inline card ─────────────────────────────────────────── */

function InlineCard({
  title,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  saveError,
  children,
  editLabel = 'Edit',
}: {
  title: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveError: string | null
  children: React.ReactNode
  editLabel?: string
}) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>
          {title}
        </h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={onEdit}>{editLabel}</Button>
        )}
      </div>
      {children}
      {editing && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {saveError && <p style={{ fontSize: 12.5, color: 'var(--danger)', flex: 1 }}>{saveError}</p>}
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="min-h-[44px]">Cancel</Button>
          <Button variant="primary" size="sm" onClick={onSave} loading={saving} className="min-h-[44px]">Save changes</Button>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
      {children}
    </div>
  )
}

function Field({ label, value, link = false, full = false }: {
  label: string
  value: string | null | undefined
  link?: boolean
  full?: boolean
}) {
  const display = value?.trim() || null
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
        {label}
      </p>
      {display && link ? (
        <a
          href={display.startsWith('http') ? display : `https://${display}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13.5, color: 'var(--violet)', textDecoration: 'none', wordBreak: 'break-all' }}
        >
          {display.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <p style={{ fontSize: 13.5, color: display ? 'var(--ink)' : 'var(--muted)', fontStyle: display ? 'normal' : 'italic', lineHeight: 1.5, margin: 0 }}>
          {display ?? '—'}
        </p>
      )}
    </div>
  )
}

function SocialRow({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>
        {label}
      </p>
      <a
        href={url.startsWith('http') ? url : `https://${url}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 13, color: 'var(--violet)', textDecoration: 'none', wordBreak: 'break-all' }}
      >
        {url.replace(/^https?:\/\//, '')}
      </a>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>{children}</p>
}
