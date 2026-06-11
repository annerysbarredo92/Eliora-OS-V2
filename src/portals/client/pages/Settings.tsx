import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClientPortal } from '@/features/portal/hooks'
import { saveSettings } from '@/features/portal/api'
import { COMM_CHANNELS, COMM_FREQUENCIES } from '@/features/portal/helpers'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ActiveToggle } from '@/features/operations/components/ServiceModal'

export function ClientSettings() {
  const { profile: user } = useAuth()
  const portal = useClientPortal(user)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    contact_name: '', contact_email: '', contact_phone: '', website: '', business_address: '',
    communication_channel: 'email', communication_frequency: 'weekly',
    notify_email: true, notify_content: true, notify_reports: true, notify_messages: true,
  })

  useEffect(() => {
    const p = portal.profile, s = portal.settings
    if (!p && !s) return
    setForm({
      contact_name: p?.contact_name ?? '', contact_email: p?.contact_email ?? '', contact_phone: p?.contact_phone ?? '',
      website: p?.website ?? '', business_address: p?.business_address ?? '',
      communication_channel: s?.communication_channel ?? 'email', communication_frequency: s?.communication_frequency ?? 'weekly',
      notify_email: s?.notify_email ?? true, notify_content: s?.notify_content ?? true,
      notify_reports: s?.notify_reports ?? true, notify_messages: s?.notify_messages ?? true,
    })
  }, [portal.profile, portal.settings])

  const ctx = user?.agency_id && user?.client_id && user?.id
    ? { agencyId: user.agency_id, clientId: user.client_id, actorId: user.id }
    : null

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!ctx) return
    setSaving(true); setError(null)
    try {
      await saveSettings({
        profile: { contact_name: form.contact_name, contact_email: form.contact_email, contact_phone: form.contact_phone, website: form.website, business_address: form.business_address },
        settings: {
          communication_channel: form.communication_channel, communication_frequency: form.communication_frequency,
          notify_email: form.notify_email, notify_content: form.notify_content, notify_reports: form.notify_reports, notify_messages: form.notify_messages,
        },
      }, ctx)
      await portal.refresh()
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (portal.loading) {
    return <div className="animate-fade-up"><div style={{ height: 360, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Keep your contact details and preferences up to date.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="Primary Contact">
          <div style={grid2}>
            <Input label="Full name" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            <Input label="Email" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          </div>
          <div style={grid2}>
            <Input label="Phone" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
            <Input label="Website" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
          </div>
          <Input label="Business address" value={form.business_address} onChange={e => set('business_address', e.target.value)} />
        </Card>

        <Card title="Communication Preferences">
          <div style={grid2}>
            <Select label="Preferred channel" value={form.communication_channel} onChange={e => set('communication_channel', e.target.value)} options={COMM_CHANNELS} />
            <Select label="Frequency" value={form.communication_frequency} onChange={e => set('communication_frequency', e.target.value)} options={COMM_FREQUENCIES} />
          </div>
        </Card>

        <Card title="Notification Preferences">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ToggleRow label="Email notifications" desc="General account and account updates" checked={form.notify_email} onChange={v => set('notify_email', v)} />
            <ToggleRow label="Content updates" desc="When new content is ready for you" checked={form.notify_content} onChange={v => set('notify_content', v)} />
            <ToggleRow label="Report updates" desc="When a new report is published" checked={form.notify_reports} onChange={v => set('notify_reports', v)} />
            <ToggleRow label="Messages" desc="When your team sends a message" checked={form.notify_messages} onChange={v => set('notify_messages', v)} />
          </div>
        </Card>

        {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Saved ✓</span>}
          <Button variant="primary" onClick={handleSave} loading={saving}>Save changes</Button>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 20 }}>
      <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--hairline-2)' }}>
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</p>
      </div>
      <ActiveToggle checked={checked} onChange={onChange} label="" />
    </div>
  )
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }
