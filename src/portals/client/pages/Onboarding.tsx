import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClientPortal } from '@/features/portal/hooks'
import { saveOnboardingSection } from '@/features/portal/api'
import { ONBOARDING_SECTIONS, SOCIAL_PLATFORMS, COMM_CHANNELS, COMM_FREQUENCIES, APPROVAL_WORKFLOWS, APPROVAL_TURNAROUNDS } from '@/features/portal/helpers'
import { PortalSection } from '@/features/portal/components/PortalSection'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

interface Form {
  company_name: string; company_size: string; industry: string; website: string; business_phone: string; business_address: string
  contact_name: string; contact_email: string; contact_phone: string; contact_title: string
  brand_voice: string; brand_notes: string
  social: Record<string, string>
  business_goals: string; target_audience: string
  communication_channel: string; communication_frequency: string; communication_notes: string
  approval_workflow: string; approval_turnaround: string; approver_name: string
}

const BLANK: Form = {
  company_name: '', company_size: '', industry: '', website: '', business_phone: '', business_address: '',
  contact_name: '', contact_email: '', contact_phone: '', contact_title: '',
  brand_voice: '', brand_notes: '',
  social: {}, business_goals: '', target_audience: '',
  communication_channel: 'email', communication_frequency: 'weekly', communication_notes: '',
  approval_workflow: 'single', approval_turnaround: '48h', approver_name: '',
}

export function ClientOnboarding() {
  const { profile: user } = useAuth()
  const portal = useClientPortal(user)
  const [form, setForm] = useState<Form>(BLANK)

  useEffect(() => {
    const p = portal.profile, s = portal.settings
    if (!p && !s) return
    setForm({
      company_name: p?.company_name ?? '', company_size: p?.company_size ?? '', industry: p?.industry ?? '',
      website: p?.website ?? '', business_phone: p?.business_phone ?? '', business_address: p?.business_address ?? '',
      contact_name: p?.contact_name ?? '', contact_email: p?.contact_email ?? '', contact_phone: p?.contact_phone ?? '', contact_title: p?.contact_title ?? '',
      brand_voice: p?.brand_voice ?? '', brand_notes: p?.brand_notes ?? '',
      social: (p?.social_accounts as Record<string, string>) ?? {},
      business_goals: p?.business_goals ?? '', target_audience: p?.target_audience ?? '',
      communication_channel: s?.communication_channel ?? 'email', communication_frequency: s?.communication_frequency ?? 'weekly', communication_notes: s?.communication_notes ?? '',
      approval_workflow: s?.approval_workflow ?? 'single', approval_turnaround: s?.approval_turnaround ?? '48h', approver_name: s?.approver_name ?? '',
    })
  }, [portal.profile, portal.settings])

  const ctx = user?.agency_id && user?.client_id && user?.id
    ? { agencyId: user.agency_id, clientId: user.client_id, actorId: user.id }
    : null

  function set<K extends keyof Form>(k: K, v: Form[K]) { setForm(f => ({ ...f, [k]: v })) }
  function setSocial(k: string, v: string) { setForm(f => ({ ...f, social: { ...f.social, [k]: v } })) }

  const done = (key: string) => !!portal.onboarding?.sections?.[key]
  const completion = portal.onboarding?.completion_pct ?? 0

  async function save(key: typeof ONBOARDING_SECTIONS[number]['key'], data: Parameters<typeof saveOnboardingSection>[1]) {
    if (!ctx) return
    await saveOnboardingSection(key, data, portal.onboarding, ctx)
    await portal.refresh()
  }

  if (portal.loading) {
    return <div className="animate-fade-up"><div style={{ height: 400, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Welcome — let's get you set up</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Tell us about your business so your team can do their best work. Each section saves on its own.</p>
      </div>

      {/* progress */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '16px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Onboarding progress</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--violet)' }}>{completion}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 999, transition: 'width 400ms ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 1. Company Information */}
        <PortalSection index={1} title="Company Information" description="The basics about your business." done={done('company_info')}
          onSave={() => save('company_info', { profile: { company_name: form.company_name, company_size: form.company_size, industry: form.industry, website: form.website, business_phone: form.business_phone, business_address: form.business_address } })}>
          <div style={grid2}><Input label="Company name" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} /></div>
          <div style={grid2}><Input label="Company size" value={form.company_size} onChange={e => set('company_size', e.target.value)} placeholder="e.g. 11–50" />
            <Input label="Website" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></div>
          <div style={grid2}><Input label="Business phone" value={form.business_phone} onChange={e => set('business_phone', e.target.value)} />
            <Input label="Business address" value={form.business_address} onChange={e => set('business_address', e.target.value)} /></div>
        </PortalSection>

        {/* 2. Primary Contact */}
        <PortalSection index={2} title="Primary Contact" description="Who we'll work with day to day." done={done('primary_contact')}
          onSave={() => save('primary_contact', { profile: { contact_name: form.contact_name, contact_email: form.contact_email, contact_phone: form.contact_phone, contact_title: form.contact_title } })}>
          <div style={grid2}><Input label="Full name" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            <Input label="Title" value={form.contact_title} onChange={e => set('contact_title', e.target.value)} /></div>
          <div style={grid2}><Input label="Email" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
            <Input label="Phone" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></div>
        </PortalSection>

        {/* 3. Brand Information */}
        <PortalSection index={3} title="Brand Information" description="Help us sound like you." done={done('brand_info')}
          onSave={() => save('brand_info', { profile: { brand_voice: form.brand_voice, brand_notes: form.brand_notes } })}>
          <Input label="Brand voice" value={form.brand_voice} onChange={e => set('brand_voice', e.target.value)} placeholder="e.g. Warm, confident, playful" />
          <Textarea label="Brand notes" value={form.brand_notes} onChange={e => set('brand_notes', e.target.value)} placeholder="Anything we should know about your brand…" rows={3} />
        </PortalSection>

        {/* 4. Social Media Accounts */}
        <PortalSection index={4} title="Social Media Accounts" description="Link the profiles we'll manage." done={done('social_accounts')}
          onSave={() => save('social_accounts', { profile: { social_accounts: form.social } })}>
          <div style={grid2}>
            {SOCIAL_PLATFORMS.map(p => (
              <Input key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} value={form.social[p] ?? ''} onChange={e => setSocial(p, e.target.value)} placeholder="@handle or URL" />
            ))}
          </div>
        </PortalSection>

        {/* 5. Business Goals */}
        <PortalSection index={5} title="Business Goals" description="What does success look like?" done={done('business_goals')}
          onSave={() => save('business_goals', { profile: { business_goals: form.business_goals, target_audience: form.target_audience } })}>
          <Textarea label="Business goals" value={form.business_goals} onChange={e => set('business_goals', e.target.value)} placeholder="Your top goals for the next few months…" rows={3} />
          <Textarea label="Target audience" value={form.target_audience} onChange={e => set('target_audience', e.target.value)} placeholder="Who are you trying to reach?" rows={2} />
        </PortalSection>

        {/* 6. Communication Preferences */}
        <PortalSection index={6} title="Communication Preferences" description="How and how often we keep in touch." done={done('communication_prefs')}
          onSave={() => save('communication_prefs', { settings: { communication_channel: form.communication_channel, communication_frequency: form.communication_frequency, communication_notes: form.communication_notes } })}>
          <div style={grid2}>
            <Select label="Preferred channel" value={form.communication_channel} onChange={e => set('communication_channel', e.target.value)} options={COMM_CHANNELS} />
            <Select label="Frequency" value={form.communication_frequency} onChange={e => set('communication_frequency', e.target.value)} options={COMM_FREQUENCIES} />
          </div>
          <Input label="Notes" value={form.communication_notes} onChange={e => set('communication_notes', e.target.value)} placeholder="Best times, who to copy, etc." />
        </PortalSection>

        {/* 7. Approval Preferences */}
        <PortalSection index={7} title="Approval Preferences" description="How you'll review and approve work." done={done('approval_prefs')}
          onSave={() => save('approval_prefs', { settings: { approval_workflow: form.approval_workflow, approval_turnaround: form.approval_turnaround, approver_name: form.approver_name } })}>
          <div style={grid2}>
            <Select label="Approval workflow" value={form.approval_workflow} onChange={e => set('approval_workflow', e.target.value)} options={APPROVAL_WORKFLOWS} />
            <Select label="Turnaround" value={form.approval_turnaround} onChange={e => set('approval_turnaround', e.target.value)} options={APPROVAL_TURNAROUNDS} />
          </div>
          <Input label="Primary approver" value={form.approver_name} onChange={e => set('approver_name', e.target.value)} placeholder="Who signs off on work?" />
        </PortalSection>
      </div>
    </div>
  )
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }
