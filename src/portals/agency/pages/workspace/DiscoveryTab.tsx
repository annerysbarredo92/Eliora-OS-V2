import { useState, useEffect } from 'react'
import { updateDiscoveryData } from '@/features/clients/api'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

type DD = {
  // Business
  industry: string; services_offered: string; products: string; pricing_model: string
  business_size: string; years_in_business: string
  // Audience
  target_audience: string; audience_pain_points: string; audience_goals: string
  current_clients: string; geographic_focus: string
  // Marketing
  social_platforms: string; current_content_strategy: string; paid_advertising: string
  email_marketing: string; website_notes: string; crm_tools: string; analytics_tools: string
  // Notes
  meeting_notes: string; call_notes: string; documents_received: string
}

const EMPTY: DD = {
  industry: '', services_offered: '', products: '', pricing_model: '', business_size: '', years_in_business: '',
  target_audience: '', audience_pain_points: '', audience_goals: '', current_clients: '', geographic_focus: '',
  social_platforms: '', current_content_strategy: '', paid_advertising: '', email_marketing: '',
  website_notes: '', crm_tools: '', analytics_tools: '',
  meeting_notes: '', call_notes: '', documents_received: '',
}

export function DiscoveryTab({ client, ctx, onChanged }: Props) {
  const [form, setForm] = useState<DD>({ ...EMPTY, ...(client.discovery_data as Partial<DD>) })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [open, setOpen]     = useState<string>('business')

  useEffect(() => {
    setForm({ ...EMPTY, ...(client.discovery_data as Partial<DD>) })
  }, [client])

  function set(k: keyof DD, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setSaving(true)
    try {
      await updateDiscoveryData(client.id, form as unknown as Record<string, unknown>, ctx)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      onChanged()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Fill in as much as you learn from discovery calls. This context powers the AI tab.
      </p>

      <Accordion title="Business Information" id="business" open={open} onToggle={setOpen}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
          <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} />
          <Input label="Business size" value={form.business_size} onChange={e => set('business_size', e.target.value)} placeholder="e.g. 5–20 employees" />
          <Input label="Years in business" value={form.years_in_business} onChange={e => set('years_in_business', e.target.value)} />
          <Input label="Pricing model" value={form.pricing_model} onChange={e => set('pricing_model', e.target.value)} placeholder="e.g. Retainer, project-based" />
        </div>
        <Textarea label="Services / Products offered" rows={3} value={form.services_offered} onChange={e => set('services_offered', e.target.value)} />
        <Textarea label="Key products" rows={2} value={form.products} onChange={e => set('products', e.target.value)} />
      </Accordion>

      <Accordion title="Audience & Goals" id="audience" open={open} onToggle={setOpen}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
          <Input label="Geographic focus" value={form.geographic_focus} onChange={e => set('geographic_focus', e.target.value)} placeholder="e.g. Miami, FL / National" />
        </div>
        <Textarea label="Target audience description" rows={3} value={form.target_audience} onChange={e => set('target_audience', e.target.value)} placeholder="Demographics, interests, job titles…" />
        <Textarea label="Audience pain points" rows={3} value={form.audience_pain_points} onChange={e => set('audience_pain_points', e.target.value)} placeholder="What problems does their audience face?" />
        <Textarea label="Audience goals" rows={2} value={form.audience_goals} onChange={e => set('audience_goals', e.target.value)} />
        <Textarea label="Current clients / customer examples" rows={2} value={form.current_clients} onChange={e => set('current_clients', e.target.value)} />
      </Accordion>

      <Accordion title="Marketing & Digital Presence" id="marketing" open={open} onToggle={setOpen}>
        <Input label="Social platforms active on" value={form.social_platforms} onChange={e => set('social_platforms', e.target.value)} placeholder="e.g. Instagram, TikTok, LinkedIn" />
        <Textarea label="Current content strategy" rows={3} value={form.current_content_strategy} onChange={e => set('current_content_strategy', e.target.value)} placeholder="What content are they posting? How often? What's working?" />
        <Textarea label="Paid advertising" rows={2} value={form.paid_advertising} onChange={e => set('paid_advertising', e.target.value)} placeholder="Platforms, budget, current performance…" />
        <Input label="Email marketing" value={form.email_marketing} onChange={e => set('email_marketing', e.target.value)} placeholder="Platform, list size, frequency" />
        <Textarea label="Website notes" rows={2} value={form.website_notes} onChange={e => set('website_notes', e.target.value)} placeholder="URL, CMS, current performance, pain points…" />
        <Input label="CRM / project management tools" value={form.crm_tools} onChange={e => set('crm_tools', e.target.value)} placeholder="e.g. HubSpot, Monday.com, Notion" />
        <Input label="Analytics tools" value={form.analytics_tools} onChange={e => set('analytics_tools', e.target.value)} placeholder="e.g. GA4, Looker Studio, Sprout Social" />
      </Accordion>

      <Accordion title="Meeting & Call Notes" id="notes" open={open} onToggle={setOpen}>
        <Textarea label="Meeting notes" rows={5} value={form.meeting_notes} onChange={e => set('meeting_notes', e.target.value)} placeholder="Notes from discovery meetings…" />
        <Textarea label="Call notes" rows={5} value={form.call_notes} onChange={e => set('call_notes', e.target.value)} placeholder="Notes from discovery calls…" />
        <Textarea label="Documents received" rows={2} value={form.documents_received} onChange={e => set('documents_received', e.target.value)} placeholder="Brand guidelines, past reports, any docs provided…" />
      </Accordion>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" onClick={save} loading={saving}>Save Discovery</Button>
        {saved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Saved</span>}
      </div>
    </div>
  )
}

function Accordion({ title, id, open, onToggle, children }: {
  title: string; id: string; open: string; onToggle: (id: string) => void; children: React.ReactNode
}) {
  const isOpen = open === id
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <button
        onClick={() => onToggle(isOpen ? '' : id)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</span>
        <span style={{ fontSize: 18, color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>›</span>
      </button>
      {isOpen && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--hairline-2)' }}>
          <div style={{ height: 8 }} />
          {children}
        </div>
      )}
    </div>
  )
}
