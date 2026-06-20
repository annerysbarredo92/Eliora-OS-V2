import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ActiveToggle } from '@/features/operations/components/ServiceModal'
import type { AgencyPortalSettings } from '@/types'

const TOGGLES: { key: keyof AgencyPortalSettings; label: string; desc: string }[] = [
  { key: 'enable_messaging',        label: 'Client Messaging',       desc: 'Let clients message your team from the portal.' },
  { key: 'enable_content_requests', label: 'Client Content Requests', desc: 'Allow clients to submit content/file/strategy requests.' },
  { key: 'enable_file_uploads',     label: 'Client File Uploads',     desc: 'Allow clients to upload requested assets.' },
  { key: 'enable_report_access',    label: 'Client Report Access',    desc: 'Show shared reports in the client portal.' },
  { key: 'enable_invoice_access',   label: 'Client Invoice Access',   desc: 'Show invoices in the client portal (when billing is live).' },
  { key: 'auto_approval',           label: 'Auto Approval',           desc: 'Automatically approve content after the review window.' },
]

export function PortalSettingsTab({ agencyId }: { agencyId: string | null }) {
  const [settings, setSettings] = useState<AgencyPortalSettings | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agencyId) return
    await supabase.rpc('ensure_agency_portal_settings', { _agency_id: agencyId })
    const { data } = await supabase.from('agency_portal_settings').select('*').eq('agency_id', agencyId).maybeSingle()
    setSettings(data as AgencyPortalSettings)
  }, [agencyId])
  useEffect(() => { load() }, [load])

  async function toggle(key: keyof AgencyPortalSettings, value: boolean) {
    if (!settings) return
    setSaving(key); setSettings({ ...settings, [key]: value })
    await supabase.from('agency_portal_settings').update({ [key]: value }).eq('id', settings.id)
    setSaving(null)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Control what your clients can do inside their portal. Changes apply across your agency.</p>
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TOGGLES.map(t => (
          <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline-2)' }}>
            <div><p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t.label}{saving === t.key ? ' …' : ''}</p><p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t.desc}</p></div>
            <ActiveToggle checked={!!settings?.[t.key]} onChange={v => toggle(t.key, v)} label="" />
          </div>
        ))}
      </div>
    </div>
  )
}
