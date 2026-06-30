import { useState, useEffect } from 'react'
import { updateLeadInfo, updateProjectFields } from '@/features/projects/api'
import { money } from '@/features/operations/helpers'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types'

const LEAD_SOURCES = ['Referral', 'Website', 'Social Media', 'Cold Outreach', 'Event', 'Partnership', 'Directory', 'Other']

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function LeadInfoTab({ client, ctx, onChanged }: Props) {
  const li = (client.lead_info ?? {}) as Record<string, string>

  const [form, setForm] = useState({
    lead_source:         client.lead_source ?? '',
    project_value_cents: client.project_value_cents ?? 0,
    estimated_budget_cents: client.estimated_budget_cents ?? 0,
    close_probability:   client.close_probability ?? 0,
    decision_maker:      client.decision_maker ?? '',
    lead_score:          client.lead_score ?? 0,
    expected_close_date: client.expected_close_date ?? '',
    next_follow_up_at:   client.next_follow_up_at ? client.next_follow_up_at.split('T')[0] : '',
    next_action:         client.next_action ?? '',
    services_interested: li.services_interested ?? '',
    pain_points:         li.pain_points ?? '',
    requirements:        li.requirements ?? '',
    competitors:         li.competitors ?? '',
    sales_notes:         li.sales_notes ?? '',
    discovery_notes:     li.discovery_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    const li2 = (client.lead_info ?? {}) as Record<string, string>
    setForm({
      lead_source:            client.lead_source ?? '',
      project_value_cents:    client.project_value_cents ?? 0,
      estimated_budget_cents: client.estimated_budget_cents ?? 0,
      close_probability:      client.close_probability ?? 0,
      decision_maker:         client.decision_maker ?? '',
      lead_score:             client.lead_score ?? 0,
      expected_close_date:    client.expected_close_date ?? '',
      next_follow_up_at:      client.next_follow_up_at ? client.next_follow_up_at.split('T')[0] : '',
      next_action:            client.next_action ?? '',
      services_interested:    li2.services_interested ?? '',
      pain_points:            li2.pain_points ?? '',
      requirements:           li2.requirements ?? '',
      competitors:            li2.competitors ?? '',
      sales_notes:            li2.sales_notes ?? '',
      discovery_notes:        li2.discovery_notes ?? '',
    })
  }, [client])

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    setSaving(true)
    try {
      await updateProjectFields(client.id, {
        lead_source:            form.lead_source || null,
        project_value_cents:    form.project_value_cents,
        estimated_budget_cents: form.estimated_budget_cents,
        close_probability:      form.close_probability || null,
        decision_maker:         form.decision_maker.trim() || null,
        lead_score:             form.lead_score || null,
        expected_close_date:    form.expected_close_date || null,
        next_follow_up_at:      form.next_follow_up_at ? `${form.next_follow_up_at}T09:00:00Z` : null,
        next_action:            form.next_action.trim() || null,
      }, ctx)
      await updateLeadInfo(client.id, {
        services_interested: form.services_interested,
        pain_points:         form.pain_points,
        requirements:        form.requirements,
        competitors:         form.competitors,
        sales_notes:         form.sales_notes,
        discovery_notes:     form.discovery_notes,
      }, ctx)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onChanged()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Deal Overview ── */}
      <Section title="Deal Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          <Select label="Lead Source" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}
            options={[{ value: '', label: 'Select…' }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} />
          <Input label="Project Value ($)" type="number" min={0}
            value={form.project_value_cents / 100 || ''}
            onChange={e => set('project_value_cents', Math.round(parseFloat(e.target.value || '0') * 100))} />
          <Input label="Est. Monthly Budget ($)" type="number" min={0}
            value={form.estimated_budget_cents / 100 || ''}
            onChange={e => set('estimated_budget_cents', Math.round(parseFloat(e.target.value || '0') * 100))} />
          <Input label="Close Probability (%)" type="number" min={0} max={100}
            value={form.close_probability || ''}
            onChange={e => set('close_probability', Math.min(100, parseInt(e.target.value || '0', 10)))} />
          <Input label="Lead Score (0–100)" type="number" min={0} max={100}
            value={form.lead_score || ''}
            onChange={e => set('lead_score', Math.min(100, parseInt(e.target.value || '0', 10)))} />
          <Input label="Expected Close Date" type="date"
            value={form.expected_close_date}
            onChange={e => set('expected_close_date', e.target.value)} />
          <Input label="Next Follow-Up Date" type="date"
            value={form.next_follow_up_at}
            onChange={e => set('next_follow_up_at', e.target.value)} />
          <Input label="Decision Maker" value={form.decision_maker}
            onChange={e => set('decision_maker', e.target.value)} placeholder="Name / title" />
        </div>
        <div style={{ marginTop: 14 }}>
          <Input label="Next Action" value={form.next_action}
            onChange={e => set('next_action', e.target.value)} placeholder="e.g. Send contract, Schedule follow-up call" />
        </div>
      </Section>

      {/* ── Services & Requirements ── */}
      <Section title="Services & Requirements">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Textarea label="Services Interested In" rows={3} value={form.services_interested}
            onChange={e => set('services_interested', e.target.value)}
            placeholder="List services, packages, or deliverables the prospect is interested in…" />
          <Textarea label="Requirements" rows={3} value={form.requirements}
            onChange={e => set('requirements', e.target.value)}
            placeholder="Specific requirements, must-haves, or constraints…" />
        </div>
      </Section>

      {/* ── Intelligence ── */}
      <Section title="Sales Intelligence">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Textarea label="Pain Points" rows={3} value={form.pain_points}
            onChange={e => set('pain_points', e.target.value)}
            placeholder="Key problems, frustrations, or needs this prospect has…" />
          <Textarea label="Competitors / Alternatives" rows={2} value={form.competitors}
            onChange={e => set('competitors', e.target.value)}
            placeholder="Competing agencies or tools they're evaluating…" />
        </div>
      </Section>

      {/* ── Notes ── */}
      <Section title="Notes">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Textarea label="Sales Notes" rows={4} value={form.sales_notes}
            onChange={e => set('sales_notes', e.target.value)}
            placeholder="Internal sales notes, call summaries, objections handled…" />
          <Textarea label="Discovery Notes" rows={4} value={form.discovery_notes}
            onChange={e => set('discovery_notes', e.target.value)}
            placeholder="Insights gathered from initial discovery conversations…" />
        </div>
      </Section>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" onClick={save} loading={saving}>Save Lead Information</Button>
        {saved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Saved</span>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>{title}</h3>
      {children}
    </div>
  )
}
