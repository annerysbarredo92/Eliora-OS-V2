import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import {
  getAgencyEmailSettings,
  getAgencyEmailDefaults,
  upsertAgencyEmailSettings,
} from '@/features/email/api'
import type { EmailSettingsFormValues } from '@/features/email/api'
import type { AgencyEmailSettings } from '@/types'

/* ── Sections ────────────────────────────────────────────── */

const SECTIONS = [
  { id: 'general',       label: 'General'       },
  { id: 'communication', label: 'Communication' },
]

/* ── Page ────────────────────────────────────────────────── */

interface Props {
  ctx: { agencyId: string; actorId: string }
}

export function AgencySettings({ ctx }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') ?? 'general'

  function changeSection(id: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('section', id)
      return next
    }, { replace: true })
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'var(--text-2xl)',
          fontWeight: 400, color: 'var(--ink)', marginBottom: 4,
        }}>
          Settings
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Configure your workspace, branding, and preferences.
        </p>
      </div>

      <nav style={{
        display: 'flex', borderBottom: '1px solid var(--hairline)',
        marginBottom: 28, overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => changeSection(s.id)}
            style={{
              padding: '8px 16px', fontSize: 13, fontFamily: 'var(--font-sans)',
              fontWeight: section === s.id ? 600 : 400,
              color: section === s.id ? 'var(--violet)' : 'var(--ink-2)',
              background: 'none', border: 'none', cursor: 'pointer',
              whiteSpace: 'nowrap', marginBottom: -1, flexShrink: 0,
              borderBottom: section === s.id ? '2px solid var(--violet)' : '2px solid transparent',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === 'general'       && <GeneralSection />}
      {section === 'communication' && <CommunicationSection ctx={ctx} />}
    </div>
  )
}

/* ── General ─────────────────────────────────────────────── */

function GeneralSection() {
  return (
    <SettingsCard title="General Settings" subtitle="Agency name, branding, and workspace preferences.">
      <Placeholder label="General settings are coming soon." />
    </SettingsCard>
  )
}

/* ── Communication → Email ───────────────────────────────── */

function blankForm(): EmailSettingsFormValues {
  return { sender_name: '', reply_to_email: '', email_signature: '', sending_enabled: false }
}

function settingsToForm(s: AgencyEmailSettings): EmailSettingsFormValues {
  return {
    sender_name:     s.sender_name,
    reply_to_email:  s.reply_to_email  ?? '',
    email_signature: s.email_signature ?? '',
    sending_enabled: s.sending_enabled,
  }
}

function CommunicationSection({ ctx }: { ctx: { agencyId: string; actorId: string } }) {
  const [settings,     setSettings]     = useState<AgencyEmailSettings | null>(null)
  const [form,         setForm]         = useState<EmailSettingsFormValues>(blankForm())
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const s = await getAgencyEmailSettings(ctx.agencyId)
    setSettings(s)
    if (s) {
      setForm(settingsToForm(s))
      setIsAutoFilled(false)
    } else {
      // No row yet (agency pre-dates migration). Pre-fill from agency profile.
      const defaults = await getAgencyEmailDefaults(ctx.agencyId)
      const sig = defaults.owner_display_name && defaults.agency_name
        ? `${defaults.owner_display_name} · ${defaults.agency_name}`
        : defaults.agency_name || ''
      setForm({
        sender_name:     defaults.agency_name,
        reply_to_email:  defaults.owner_email ?? '',
        email_signature: sig,
        sending_enabled: defaults.owner_email != null,
      })
      setIsAutoFilled(true)
    }
    setLoading(false)
  }, [ctx.agencyId])

  useEffect(() => { load() }, [load])

  function setField<K extends keyof EmailSettingsFormValues>(k: K, v: EmailSettingsFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function save() {
    if (!form.sender_name.trim()) { setError('Sender name is required'); return }
    setSaving(true); setError(null)
    try {
      await upsertAgencyEmailSettings(ctx.agencyId, form)
      setSaved(true)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[140, 220, 80].map(h => (
          <div key={h} style={{ height: h, background: 'var(--lavender-soft)', borderRadius: 'var(--radius)', opacity: 0.4 }} />
        ))}
      </div>
    )
  }

  const missingReplyTo = form.sending_enabled && !form.reply_to_email.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Auto-configured notice ──────────────────────────── */}
      {isAutoFilled && (
        <InfoBox>
          Email sending has been pre-configured from your agency profile. Review the defaults below and save to confirm, or edit to customize.
        </InfoBox>
      )}

      {/* ── Sender Identity ─────────────────────────────────── */}
      <SettingsCard
        title="Sender Identity"
        subtitle="How your agency appears in the From line when you send emails from Eliora."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
          <Input
            label="Sender Name *"
            value={form.sender_name}
            onChange={e => setField('sender_name', e.target.value)}
            placeholder="Acme Agency"
          />
          <div>
            <Input
              label="Reply-To Email"
              type="email"
              value={form.reply_to_email}
              onChange={e => setField('reply_to_email', e.target.value)}
              placeholder="hello@youragency.com"
            />
            {missingReplyTo && (
              <p style={{ fontSize: 11.5, color: 'var(--warning, #b45309)', marginTop: 5 }}>
                Required when sending is enabled — recipients can't reply without it.
              </p>
            )}
          </div>
          <Textarea
            label="Email Signature"
            value={form.email_signature}
            onChange={e => setField('email_signature', e.target.value)}
            placeholder="e.g. The Acme Team · acmeagency.com"
            rows={3}
          />
        </div>
      </SettingsCard>

      {/* ── Sending Domain ──────────────────────────────────── */}
      <SettingsCard
        title="Sending Domain"
        subtitle="Emails are sent from Eliora's shared domain. Your sender name appears in the From line."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
          <DomainRow
            label="Shared Eliora Domain"
            status="connected"
            description="All agencies on Eliora share a verified sending domain managed by Eliora."
          />
          <DomainRow
            label="Custom Domain"
            status="unavailable"
            description="Send from your own domain. Available in a future plan."
          />
        </div>
      </SettingsCard>

      {/* ── Enable sending ──────────────────────────────────── */}
      <SettingsCard
        title="Email Sending"
        subtitle="Control whether your team can send emails from Business → Contacts."
      >
        <div style={{ maxWidth: 520 }}>
          <CheckRow
            label="Enable email sending"
            description="Allow your team to send emails directly from contact cards in Eliora."
            checked={form.sending_enabled}
            onChange={v => setField('sending_enabled', v)}
          />
        </div>
      </SettingsCard>

      {/* ── Save ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" size="sm" onClick={save} loading={saving}>
          Save settings
        </Button>
        {saved && !error && (
          <span style={{ fontSize: 12.5, color: '#16a34a', fontWeight: 500 }}>Saved</span>
        )}
        {error && (
          <span style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
        )}
      </div>

      {/* ── Status summary (only after settings exist) ──────── */}
      {settings && (
        <InfoBox>
          {settings.sending_enabled
            ? `Emails will be sent as "${settings.sender_name}" from Eliora's shared domain${settings.reply_to_email ? ` · replies go to ${settings.reply_to_email}` : ''}.`
            : 'Email sending is currently disabled. Enable it above to let your team send emails from contact cards.'}
        </InfoBox>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function SettingsCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '24px 28px',
    }}>
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{title}</p>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function DomainRow({ label, status, description }: {
  label: string
  status: 'connected' | 'unavailable'
  description: string
}) {
  const isConnected = status === 'connected'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', borderRadius: 10,
      background: isConnected ? 'var(--lavender-soft)' : 'var(--surface)',
      border: `1px solid ${isConnected ? 'var(--hairline)' : 'var(--hairline-2, var(--hairline))'}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
        background: isConnected ? '#16a34a' : 'var(--muted)',
      }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', padding: '2px 7px', borderRadius: 20,
            color:       isConnected ? '#16a34a'        : 'var(--muted)',
            background:  isConnected ? '#dcfce7'        : 'var(--surface)',
            border:      isConnected ? '1px solid #bbf7d0' : '1px solid var(--hairline)',
          }}>
            {isConnected ? 'Connected' : 'Coming later'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  )
}

function CheckRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: 'var(--violet)', marginTop: 3, cursor: 'pointer', flexShrink: 0 }}
      />
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{description}</p>
      </div>
    </label>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--lavender-soft)', borderRadius: 10,
      padding: '11px 14px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <p style={{ fontSize: 13.5, color: 'var(--muted)', padding: '32px 0', textAlign: 'center' }}>
      {label}
    </p>
  )
}
