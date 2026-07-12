import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ChipList } from '@/components/ui/ChipList'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import { updateDiscoveryData } from '@/features/clients/api'
import type { Client, BrandVisual, BrandVoiceDomain, BrandStrategyDomain, BrandColor, BrandFont } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

type EditingCard = 'visual' | 'voice' | 'strategy' | null

/* ── Domain readers ──────────────────────────────────────── */

function readVisual(dd: Record<string, unknown>): BrandVisual {
  const raw = dd.brand_visual as Partial<BrandVisual> | undefined
  return {
    colors:    Array.isArray(raw?.colors) ? raw.colors as BrandColor[] : [],
    fonts:     Array.isArray(raw?.fonts)  ? raw.fonts as BrandFont[]   : [],
    photo_style: typeof raw?.photo_style === 'string' ? raw.photo_style : '',
    logo_ids:  raw?.logo_ids ?? { primary: null, secondary: null, icon: null },
  }
}

function readVoice(dd: Record<string, unknown>): BrandVoiceDomain {
  const raw = dd.brand_voice
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>
    return {
      voice_descriptor:    typeof r.voice_descriptor === 'string' ? r.voice_descriptor : '',
      tone_guidelines:     typeof r.tone_guidelines  === 'string' ? r.tone_guidelines  : '',
      approved_language:   Array.isArray(r.approved_language)   ? r.approved_language as string[]   : [],
      prohibited_language: Array.isArray(r.prohibited_language) ? r.prohibited_language as string[] : [],
      writing_example:     typeof r.writing_example  === 'string' ? r.writing_example  : '',
    }
  }
  // legacy: was a string
  return {
    voice_descriptor:    typeof raw === 'string' ? raw : '',
    tone_guidelines:     '',
    approved_language:   [],
    prohibited_language: [],
    writing_example:     '',
  }
}

function readStrategy(dd: Record<string, unknown>): BrandStrategyDomain {
  const raw = dd.brand_strategy as Partial<BrandStrategyDomain> | undefined
  return {
    mission:           typeof raw?.mission           === 'string' ? raw.mission           : '',
    vision:            typeof raw?.vision            === 'string' ? raw.vision            : '',
    positioning:       typeof raw?.positioning       === 'string' ? raw.positioning       : '',
    uvp:               typeof raw?.uvp               === 'string' ? raw.uvp               : '',
    values:            Array.isArray(raw?.values)            ? raw.values as string[]            : [],
    taglines:          Array.isArray(raw?.taglines)          ? raw.taglines as string[]          : [],
    approved_messaging: Array.isArray(raw?.approved_messaging) ? raw.approved_messaging as string[] : [],
    hashtags:          Array.isArray(raw?.hashtags)          ? raw.hashtags as string[]          : [],
    keywords:          Array.isArray(raw?.keywords)          ? raw.keywords as string[]          : [],
  }
}

/* ── Sub-components ──────────────────────────────────────── */

const COLOR_ROLES = ['Primary', 'Secondary', 'Accent', 'Background', 'Text', 'Other']
const FONT_ROLES  = ['Heading', 'Body', 'Accent', 'UI', 'Other']

function ColorEditor({ colors, onChange }: { colors: BrandColor[]; onChange: (c: BrandColor[]) => void }) {
  const [hex, setHex]   = useState('#')
  const [name, setName] = useState('')
  const [role, setRole] = useState('Primary')

  function add() {
    const h = hex.trim()
    if (!h || h === '#') return
    const normalized = h.startsWith('#') ? h : `#${h}`
    onChange([...colors, { hex: normalized, name: name.trim() || normalized, role }])
    setHex('#'); setName(''); setRole('Primary')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {colors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {colors.map((c, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ColorSwatch hex={c.hex} size={36} />
              <span style={{ fontSize: 11, color: 'var(--ink-2)', textAlign: 'center' }}>
                {c.name}<br />
                <span style={{ color: 'var(--muted)' }}>{c.role}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(colors.filter((_, j) => j !== i))}
                style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Hex</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="color"
              value={hex === '#' ? '#000000' : hex}
              onChange={e => setHex(e.target.value)}
              style={{ width: 28, height: 28, border: '1px solid var(--hairline)', borderRadius: 4, padding: 2, cursor: 'pointer' }}
            />
            <input
              value={hex}
              onChange={e => setHex(e.target.value)}
              placeholder="#000000"
              style={{ flex: 1, fontSize: 12, padding: '4px 6px', border: '1px solid var(--hairline)', borderRadius: 6, fontFamily: 'monospace' }}
            />
          </div>
        </div>
        <Input label="Color name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Deep Navy" />
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            style={{ fontSize: 13, padding: '8px 10px', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-solid)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
          >
            {COLOR_ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <Button variant="ghost" size="sm" onClick={add} style={{ alignSelf: 'end' }}>Add</Button>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */

export function BrandSection({ client, ctx, onChanged }: Props) {
  const dd       = (client.discovery_data ?? {}) as Record<string, unknown>
  const [editing, setEditing] = useState<EditingCard>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  /* ── Visual Identity ─────────────────────────────────── */
  const savedVisual = readVisual(dd)
  const [visualForm, setVisualForm] = useState(savedVisual)

  function startEditVisual() { setVisualForm(readVisual(dd)); setEditing('visual'); setError(null) }

  async function saveVisual() {
    setSaving(true); setError(null)
    try {
      await updateDiscoveryData(client.id, { brand_visual: visualForm }, ctx)
      onChanged(); setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  /* ── Brand Voice ─────────────────────────────────────── */
  const savedVoice = readVoice(dd)
  const [voiceForm, setVoiceForm] = useState(savedVoice)

  function startEditVoice() { setVoiceForm(readVoice(dd)); setEditing('voice'); setError(null) }

  async function saveVoice() {
    setSaving(true); setError(null)
    try {
      await updateDiscoveryData(client.id, { brand_voice: voiceForm }, ctx)
      onChanged(); setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  /* ── Brand Strategy ──────────────────────────────────── */
  const savedStrategy = readStrategy(dd)
  const [stratForm, setStratForm] = useState(savedStrategy)

  function startEditStrategy() { setStratForm(readStrategy(dd)); setEditing('strategy'); setError(null) }

  async function saveStrategy() {
    setSaving(true); setError(null)
    try {
      await updateDiscoveryData(client.id, { brand_strategy: stratForm }, ctx)
      onChanged(); setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Visual Identity ─────────────────────────────── */}
      <Card
        title="Visual Identity"
        editing={editing === 'visual'}
        onEdit={editing === null ? startEditVisual : undefined}
        onSave={saveVisual}
        onCancel={() => setEditing(null)}
        saving={saving}
        error={editing === 'visual' ? error : null}
      >
        {editing === 'visual' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label>Brand Colors</Label>
              <ColorEditor
                colors={visualForm.colors}
                onChange={c => setVisualForm(f => ({ ...f, colors: c }))}
              />
            </div>
            <div>
              <Label>Brand Fonts (press Enter to add)</Label>
              <ChipList
                values={visualForm.fonts.map(f => f.name)}
                onChange={names => setVisualForm(f => ({
                  ...f,
                  fonts: names.map((n, i) => ({ name: n, role: f.fonts[i]?.role ?? 'Body' })),
                }))}
                placeholder="e.g. Montserrat"
              />
            </div>
            <Textarea
              label="Photography / Visual Style"
              rows={3}
              value={visualForm.photo_style}
              onChange={e => setVisualForm(f => ({ ...f, photo_style: e.target.value }))}
              placeholder="Describe the visual aesthetic: colors, mood, imagery style…"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {savedVisual.colors.length > 0 ? (
              <div>
                <Label>Brand Colors</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
                  {savedVisual.colors.map((c, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <ColorSwatch hex={c.hex} size={36} />
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', textAlign: 'center' }}>
                        {c.name}<br /><span style={{ color: 'var(--muted)' }}>{c.role}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyField label="Brand Colors" placeholder="No brand colors added yet" />
            )}
            {savedVisual.fonts.length > 0 ? (
              <div>
                <Label>Brand Fonts</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {savedVisual.fonts.map((f, i) => (
                    <span key={i} style={{ fontSize: 12.5, padding: '3px 10px', borderRadius: 9999, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyField label="Brand Fonts" placeholder="No fonts added yet" />
            )}
            {savedVisual.photo_style ? (
              <div>
                <Label>Visual Style</Label>
                <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, marginTop: 4 }}>{savedVisual.photo_style}</p>
              </div>
            ) : (
              <EmptyField label="Visual Style" placeholder="Not described yet" />
            )}
          </div>
        )}
      </Card>

      {/* ── Brand Voice ─────────────────────────────────── */}
      <Card
        title="Brand Voice"
        editing={editing === 'voice'}
        onEdit={editing === null ? startEditVoice : undefined}
        onSave={saveVoice}
        onCancel={() => setEditing(null)}
        saving={saving}
        error={editing === 'voice' ? error : null}
      >
        {editing === 'voice' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Textarea
              label="Voice Descriptor"
              rows={2}
              value={voiceForm.voice_descriptor}
              onChange={e => setVoiceForm(f => ({ ...f, voice_descriptor: e.target.value }))}
              placeholder="e.g. Professional but warm, confident, empathetic"
            />
            <Textarea
              label="Tone Guidelines"
              rows={3}
              value={voiceForm.tone_guidelines}
              onChange={e => setVoiceForm(f => ({ ...f, tone_guidelines: e.target.value }))}
              placeholder="How should writers adjust tone for different contexts?"
            />
            <div>
              <Label>Approved Language (press Enter to add)</Label>
              <ChipList values={voiceForm.approved_language} onChange={v => setVoiceForm(f => ({ ...f, approved_language: v }))} placeholder="e.g. 'partner', 'grow together'" />
            </div>
            <div>
              <Label>Prohibited Language (press Enter to add)</Label>
              <ChipList values={voiceForm.prohibited_language} onChange={v => setVoiceForm(f => ({ ...f, prohibited_language: v }))} placeholder="e.g. 'cheap', 'discount'" />
            </div>
            <Textarea
              label="Writing Example"
              rows={4}
              value={voiceForm.writing_example}
              onChange={e => setVoiceForm(f => ({ ...f, writing_example: e.target.value }))}
              placeholder="Paste a sample of on-brand copy here…"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FieldRow label="Voice Descriptor"  value={savedVoice.voice_descriptor}   />
            <FieldRow label="Tone Guidelines"   value={savedVoice.tone_guidelines}    />
            <ChipFieldRow label="Approved Language"   chips={savedVoice.approved_language}   />
            <ChipFieldRow label="Prohibited Language" chips={savedVoice.prohibited_language} />
            <FieldRow label="Writing Example"   value={savedVoice.writing_example}    />
          </div>
        )}
      </Card>

      {/* ── Brand Strategy ───────────────────────────────── */}
      <Card
        title="Brand Strategy"
        editing={editing === 'strategy'}
        onEdit={editing === null ? startEditStrategy : undefined}
        onSave={saveStrategy}
        onCancel={() => setEditing(null)}
        saving={saving}
        error={editing === 'strategy' ? error : null}
      >
        {editing === 'strategy' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Textarea label="Mission"      rows={2} value={stratForm.mission}     onChange={e => setStratForm(f => ({ ...f, mission:     e.target.value }))} placeholder="Why this brand exists…" />
            <Textarea label="Vision"       rows={2} value={stratForm.vision}      onChange={e => setStratForm(f => ({ ...f, vision:      e.target.value }))} placeholder="Where they're going…" />
            <div><Label>Core Values</Label><ChipList values={stratForm.values}    onChange={v => setStratForm(f => ({ ...f, values:    v }))} placeholder="e.g. Integrity" /></div>
            <Textarea label="Positioning"  rows={2} value={stratForm.positioning} onChange={e => setStratForm(f => ({ ...f, positioning: e.target.value }))} placeholder="For [audience], [brand] is [benefit] because [reason]…" />
            <Textarea label="Unique Value Proposition" rows={2} value={stratForm.uvp} onChange={e => setStratForm(f => ({ ...f, uvp: e.target.value }))} placeholder="What makes this brand different…" />
            <div><Label>Taglines</Label><ChipList values={stratForm.taglines}            onChange={v => setStratForm(f => ({ ...f, taglines:          v }))} placeholder="Add tagline…" /></div>
            <div><Label>Approved Messaging</Label><ChipList values={stratForm.approved_messaging} onChange={v => setStratForm(f => ({ ...f, approved_messaging: v }))} placeholder="Add message…" /></div>
            <div><Label>Hashtags</Label><ChipList values={stratForm.hashtags}            onChange={v => setStratForm(f => ({ ...f, hashtags:          v }))} placeholder="e.g. #GrowWithUs" /></div>
            <div><Label>Keywords</Label><ChipList values={stratForm.keywords}            onChange={v => setStratForm(f => ({ ...f, keywords:          v }))} placeholder="e.g. agency, marketing" /></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FieldRow label="Mission"     value={savedStrategy.mission}     />
            <FieldRow label="Vision"      value={savedStrategy.vision}      />
            <ChipFieldRow label="Core Values" chips={savedStrategy.values}  />
            <FieldRow label="Positioning" value={savedStrategy.positioning} />
            <FieldRow label="Unique Value Proposition" value={savedStrategy.uvp} />
            <ChipFieldRow label="Taglines"          chips={savedStrategy.taglines}          />
            <ChipFieldRow label="Approved Messaging" chips={savedStrategy.approved_messaging} />
            <ChipFieldRow label="Hashtags"          chips={savedStrategy.hashtags}          />
            <ChipFieldRow label="Keywords"          chips={savedStrategy.keywords}          />
          </div>
        )}
      </Card>

    </div>
  )
}

/* ── Shared UI helpers ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function EmptyField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>{placeholder}</p>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return <EmptyField label={label} placeholder={`No ${label.toLowerCase()} added yet`} />
  return (
    <div>
      <Label>{label}</Label>
      <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  )
}

function ChipFieldRow({ label, chips }: { label: string; chips: string[] }) {
  if (!chips.length) return <EmptyField label={label} placeholder={`No ${label.toLowerCase()} added yet`} />
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {chips.map((c, i) => (
          <span key={i} style={{ fontSize: 12.5, padding: '3px 10px', borderRadius: 9999, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>{c}</span>
        ))}
      </div>
    </div>
  )
}

function Card({
  title, editing, onEdit, onSave, onCancel, saving, error, children,
}: {
  title: string
  editing: boolean
  onEdit?: () => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h3>
        {!editing && onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        )}
      </div>
      <div style={{ padding: '16px 18px' }}>
        {children}
        {editing && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button variant="primary" size="sm" onClick={onSave} loading={saving}>Save</Button>
            <Button variant="ghost"   size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
            {error && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
