import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
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
  { id: 'x',               label: 'X (Twitter)',     placeholder: 'https://x.com/yourbrand' },
  { id: 'pinterest',       label: 'Pinterest',       placeholder: 'https://pinterest.com/yourbrand' },
  { id: 'google_business', label: 'Google Business', placeholder: 'https://g.page/yourbrand' },
]

const BUSINESS_MODELS = [
  { value: '',           label: 'Select…' },
  { value: 'b2b',        label: 'B2B' },
  { value: 'b2c',        label: 'B2C' },
  { value: 'b2b2c',      label: 'B2B2C' },
  { value: 'marketplace',label: 'Marketplace' },
  { value: 'saas',       label: 'SaaS' },
  { value: 'ecommerce',  label: 'E-commerce' },
  { value: 'service',    label: 'Service Business' },
  { value: 'other',      label: 'Other' },
]

const EMPLOYEE_RANGES = [
  { value: '',      label: 'Select…' },
  { value: '1-5',   label: '1–5' },
  { value: '6-10',  label: '6–10' },
  { value: '11-25', label: '11–25' },
  { value: '26-50', label: '26–50' },
  { value: '51-100',  label: '51–100' },
  { value: '101-250', label: '101–250' },
  { value: '251-500', label: '251–500' },
  { value: '500+',    label: '500+' },
]

/* ── Types ───────────────────────────────────────────────── */

interface CompanyFormValues {
  business_name: string
  industry: string
  website: string
  business_phone: string
  business_address: string
  location: string
}

interface BusinessFormValues {
  founded_year: string
  employee_count: string
  business_model: string
  service_area: string
  target_audience: string
  primary_services: string
  avg_customer_value: string
}

type SocialForm = Record<string, string>
type SavingKey = 'company' | 'business' | 'social' | null

/* ── Form builders ───────────────────────────────────────── */

function buildCompanyForm(c: Client): CompanyFormValues {
  return {
    business_name:    c.business_name ?? '',
    industry:         c.industry ?? '',
    website:          c.website ?? '',
    business_phone:   c.business_phone ?? '',
    business_address: c.business_address ?? '',
    location:         c.location ?? '',
  }
}

function buildBusinessForm(c: Client): BusinessFormValues {
  const d = (c.discovery_data ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '')
  return {
    founded_year:       str('founded_year'),
    employee_count:     str('employee_count'),
    business_model:     str('business_model'),
    service_area:       str('service_area'),
    target_audience:    str('target_audience'),
    primary_services:   str('primary_services'),
    avg_customer_value: str('avg_customer_value'),
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
  const [companyOpen,  setCompanyOpen]  = useState(false)
  const [businessOpen, setBusinessOpen] = useState(false)
  const [socialOpen,   setSocialOpen]   = useState(false)

  const [companyForm,  setCompanyForm]  = useState<CompanyFormValues>(buildCompanyForm(client))
  const [businessForm, setBusinessForm] = useState<BusinessFormValues>(buildBusinessForm(client))
  const [socialForm,   setSocialForm]   = useState<SocialForm>(buildSocialForm(client))

  const [saving,    setSaving]    = useState<SavingKey>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  function openCompany()  { setSaveError(null); setCompanyForm(buildCompanyForm(client));   setCompanyOpen(true) }
  function openBusiness() { setSaveError(null); setBusinessForm(buildBusinessForm(client)); setBusinessOpen(true) }
  function openSocial()   { setSaveError(null); setSocialForm(buildSocialForm(client));     setSocialOpen(true) }

  async function saveCompany() {
    if (!companyForm.business_name.trim()) { setSaveError('Business name is required'); return }
    setSaving('company'); setSaveError(null)
    try {
      await updateCompanyInfo(client.id, {
        business_name:    companyForm.business_name.trim(),
        industry:         companyForm.industry.trim() || null,
        website:          companyForm.website.trim() || null,
        business_phone:   companyForm.business_phone.trim() || null,
        business_address: companyForm.business_address.trim() || null,
        location:         companyForm.location.trim() || null,
      }, ctx)
      setCompanyOpen(false)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(null) }
  }

  async function saveBusiness() {
    setSaving('business'); setSaveError(null)
    try {
      await updateDiscoveryData(client.id, client.discovery_data ?? {}, {
        founded_year:       businessForm.founded_year.trim() || null,
        employee_count:     businessForm.employee_count || null,
        business_model:     businessForm.business_model || null,
        service_area:       businessForm.service_area.trim() || null,
        target_audience:    businessForm.target_audience.trim() || null,
        primary_services:   businessForm.primary_services.trim() || null,
        avg_customer_value: businessForm.avg_customer_value.trim() || null,
      }, ctx)
      setBusinessOpen(false)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(null) }
  }

  async function saveSocial() {
    setSaving('social'); setSaveError(null)
    try {
      await updateDiscoveryData(client.id, client.discovery_data ?? {}, {
        social_urls: socialForm,
      }, ctx)
      setSocialOpen(false)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(null) }
  }

  // Derived display values
  const dv = (key: string): string | null => {
    const v = (client.discovery_data ?? {})[key]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const socialStored = ((client.discovery_data ?? {}) as Record<string, unknown>).social_urls
  const social = (typeof socialStored === 'object' && socialStored !== null
    ? socialStored : {}) as Record<string, string>
  const hasBusinessInfo = ['founded_year','employee_count','business_model','service_area',
    'target_audience','primary_services','avg_customer_value'].some(k => dv(k))
  const hasSocial = SOCIAL_PLATFORMS.some(p => social[p.id])

  const modalFooter = (key: SavingKey, onCancel: () => void, onSave: () => void) => (
    <>
      {saveError && <p style={{ fontSize: 12.5, color: 'var(--danger)', flex: 1, alignSelf: 'center' }}>{saveError}</p>}
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving === key}>Cancel</Button>
      <Button variant="primary" size="sm" onClick={onSave} loading={saving === key}>Save changes</Button>
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Company Information ───────────────────────────────── */}
      <InfoCard title="Company Information" onEdit={openCompany}>
        <FieldGrid>
          <Field label="Business Name" value={client.business_name} />
          <Field label="Industry"      value={client.industry} />
          <Field label="Website"       value={client.website} link />
          <Field label="Phone"         value={client.business_phone} />
          <Field label="Address"       value={client.business_address} full />
          <Field label="Location"      value={client.location} />
        </FieldGrid>
      </InfoCard>

      {/* ── Business Information ──────────────────────────────── */}
      <InfoCard title="Business Information" onEdit={openBusiness}>
        {!hasBusinessInfo ? (
          <Empty>No business information added yet.</Empty>
        ) : (
          <FieldGrid>
            <Field label="Founded"            value={dv('founded_year')} />
            <Field label="Employees"          value={dv('employee_count')} />
            <Field label="Business Model"     value={dv('business_model')} />
            <Field label="Avg. Customer Value" value={dv('avg_customer_value')} />
            <Field label="Service Area"       value={dv('service_area')} full />
            <Field label="Target Audience"    value={dv('target_audience')} full />
            <Field label="Primary Services"   value={dv('primary_services')} full />
          </FieldGrid>
        )}
      </InfoCard>

      {/* ── Social Presence ───────────────────────────────────── */}
      <InfoCard title="Social Presence" onEdit={openSocial}>
        {!hasSocial ? (
          <Empty>No social profiles added yet.</Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {SOCIAL_PLATFORMS.filter(p => social[p.id]).map(p => (
              <SocialRow key={p.id} label={p.label} url={social[p.id]} />
            ))}
          </div>
        )}
      </InfoCard>

      {/* ── Company Info Modal ────────────────────────────────── */}
      <Modal
        open={companyOpen}
        onClose={() => { setCompanyOpen(false); setSaveError(null) }}
        title="Edit Company Information"
        footer={modalFooter('company', () => { setCompanyOpen(false); setSaveError(null) }, saveCompany)}
      >
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
              label="Website"
              value={companyForm.website}
              onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://example.com"
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
          <Input
            label="Location / City"
            value={companyForm.location}
            onChange={e => setCompanyForm(f => ({ ...f, location: e.target.value }))}
            placeholder="New York, US"
          />
        </div>
      </Modal>

      {/* ── Business Info Modal ───────────────────────────────── */}
      <Modal
        open={businessOpen}
        onClose={() => { setBusinessOpen(false); setSaveError(null) }}
        title="Edit Business Information"
        footer={modalFooter('business', () => { setBusinessOpen(false); setSaveError(null) }, saveBusiness)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              placeholder="e.g. $5,000/yr or $500/mo"
            />
          </div>
          <Input
            label="Service Area"
            value={businessForm.service_area}
            onChange={e => setBusinessForm(f => ({ ...f, service_area: e.target.value }))}
            placeholder="e.g. North America, New York Metro"
          />
          <Textarea
            label="Target Audience"
            rows={3}
            value={businessForm.target_audience}
            onChange={e => setBusinessForm(f => ({ ...f, target_audience: e.target.value }))}
            placeholder="Who are their customers? Demographics, psychographics…"
          />
          <Textarea
            label="Primary Services / Products"
            rows={3}
            value={businessForm.primary_services}
            onChange={e => setBusinessForm(f => ({ ...f, primary_services: e.target.value }))}
            placeholder="Main products or services they offer…"
          />
        </div>
      </Modal>

      {/* ── Social Presence Modal ─────────────────────────────── */}
      <Modal
        open={socialOpen}
        onClose={() => { setSocialOpen(false); setSaveError(null) }}
        title="Edit Social Presence"
        subtitle="Add profile URLs for each platform. Leave blank to remove."
        footer={modalFooter('social', () => { setSocialOpen(false); setSaveError(null) }, saveSocial)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </Modal>

    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function InfoCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>
          {title}
        </h3>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
      </div>
      {children}
    </div>
  )
}

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
