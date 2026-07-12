import { useState, useRef } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ChipList } from '@/components/ui/ChipList'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import { updateDiscoveryData } from '@/features/clients/api'
import { uploadLogo, removeLogo, uploadBrandFile, deleteBrandFile, openBrandFile, getBrandSignedUrl } from '@/features/brand/api'
import { useBrandAssets } from '@/features/brand/hooks'
import { formatBytes } from '@/lib/storage'
import type { Client, BrandVisual, BrandVoiceDomain, BrandStrategyDomain, BrandColor, BrandFont, ClientAsset } from '@/types'
import type { LogoSlot, BrandCtx } from '@/features/brand/api'

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

/* ── Logo slot component ─────────────────────────────────── */

function LogoSlotCard({
  slot,
  label,
  asset,
  logoIds,
  brandCtx,
  onDone,
}: {
  slot: LogoSlot
  label: string
  asset: ClientAsset | null
  logoIds: { primary: string | null; secondary: string | null; icon: string | null }
  brandCtx: BrandCtx
  onDone: () => void
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving]   = useState(false)
  const [progress, setProgress]   = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [err, setErr]  = useState<string | null>(null)

  // Load signed URL when asset changes
  useState(() => {
    if (!asset) { setPreviewUrl(null); return }
    getBrandSignedUrl(asset.storage_path).then(u => setPreviewUrl(u)).catch(() => setPreviewUrl(null))
  })

  async function handleFile(file: File) {
    setUploading(true); setProgress(0); setErr(null)
    try {
      await uploadLogo(file, slot, logoIds, brandCtx, pct => setProgress(pct))
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  async function handleRemove() {
    if (!asset) return
    setRemoving(true); setErr(null)
    try {
      await removeLogo(asset.id, asset.storage_path, slot, logoIds, brandCtx)
      setPreviewUrl(null)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Remove failed')
    } finally { setRemoving(false) }
  }

  const isImage = asset?.mime_type?.startsWith('image/')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label>{label}</Label>
      <div style={{
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        background: 'var(--bg)',
      }}>
        {/* Preview zone */}
        <div style={{
          width: 64, height: 64, borderRadius: 8, flexShrink: 0,
          background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {isImage && previewUrl ? (
            <img src={previewUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : asset ? (
            <span style={{ fontSize: 22 }}>📄</span>
          ) : (
            <span style={{ fontSize: 22, color: 'var(--muted)' }}>🖼</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {asset ? (
            <>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatBytes(asset.size_bytes ?? 0)}</p>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>No {label.toLowerCase()} uploaded</p>
          )}
          {uploading && (
            <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'var(--hairline)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--violet)', borderRadius: 99, transition: 'width 200ms ease' }} />
            </div>
          )}
          {err && <p style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>{err}</p>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.zip,.svg"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
            {asset ? 'Replace' : 'Upload'}
          </Button>
          {asset && (
            <Button variant="ghost" size="sm" onClick={handleRemove} loading={removing} style={{ color: 'var(--danger)' }}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Brand file list ─────────────────────────────────────── */

function BrandFileRow({ asset, brandCtx, onDone }: { asset: ClientAsset; brandCtx: BrandCtx; onDone: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm(`Delete "${asset.name}"?`)) return
    setDeleting(true); setErr(null)
    try {
      await deleteBrandFile(asset, brandCtx)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    } finally { setDeleting(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{asset.mime_type?.startsWith('image/') ? '🖼' : '📄'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={() => openBrandFile(asset)}
          style={{ fontSize: 13, fontWeight: 500, color: 'var(--violet)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
        >
          {asset.name}
        </button>
        <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatBytes(asset.size_bytes ?? 0)}</p>
        {err && <p style={{ fontSize: 11.5, color: 'var(--danger)' }}>{err}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={handleDelete} loading={deleting} style={{ color: 'var(--danger)', flexShrink: 0 }}>Delete</Button>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */

export function BrandSection({ client, ctx, onChanged }: Props) {
  const dd       = (client.discovery_data ?? {}) as Record<string, unknown>
  const [editing, setEditing] = useState<EditingCard>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Brand assets + logo IDs
  const brandCtx: BrandCtx = { agencyId: ctx.agencyId, clientId: client.id, actorId: ctx.actorId }
  const { primaryLogo, secondaryLogo, iconLogo, otherFiles, loading: assetsLoading, error: assetsError, refresh: refreshAssets } = useBrandAssets(client)
  const savedVisualForAssets = readVisual(dd)
  const logoIds = savedVisualForAssets.logo_ids

  const brandFileInputRef = useRef<HTMLInputElement>(null)
  const [brandFileUploading, setBrandFileUploading] = useState(false)
  const [brandFileErr, setBrandFileErr] = useState<string | null>(null)

  async function handleBrandFileUpload(file: File) {
    setBrandFileUploading(true); setBrandFileErr(null)
    try {
      await uploadBrandFile(file, brandCtx)
      refreshAssets(); onChanged()
    } catch (e) {
      setBrandFileErr(e instanceof Error ? e.message : 'Upload failed')
    } finally { setBrandFileUploading(false) }
  }

  function handleLogoChanged() { refreshAssets(); onChanged() }

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

      {/* ── Brand Assets ─────────────────────────────────── */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Brand Assets</h3>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {assetsError && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>Could not load assets: {assetsError}</p>}

          {/* Logos */}
          <div>
            <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Logos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LogoSlotCard slot="primary"   label="Primary Logo"   asset={primaryLogo}   logoIds={logoIds} brandCtx={brandCtx} onDone={handleLogoChanged} />
              <LogoSlotCard slot="secondary" label="Secondary Logo" asset={secondaryLogo} logoIds={logoIds} brandCtx={brandCtx} onDone={handleLogoChanged} />
              <LogoSlotCard slot="icon"      label="Brand Icon"     asset={iconLogo}      logoIds={logoIds} brandCtx={brandCtx} onDone={handleLogoChanged} />
            </div>
          </div>

          {/* Brand files */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Brand Files</p>
              <div>
                <input
                  ref={brandFileInputRef}
                  type="file"
                  accept="image/*,.pdf,.zip,.svg,.ai,.eps"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleBrandFileUpload(f); e.target.value = '' }}
                />
                <Button variant="ghost" size="sm" onClick={() => brandFileInputRef.current?.click()} loading={brandFileUploading}>
                  Upload File
                </Button>
              </div>
            </div>
            {brandFileErr && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 8 }}>{brandFileErr}</p>}
            {assetsLoading ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
            ) : otherFiles.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>No brand files uploaded yet — add brand guidelines, photography, or reference files.</p>
            ) : (
              <div>
                {otherFiles.map(asset => (
                  <BrandFileRow key={asset.id} asset={asset} brandCtx={brandCtx} onDone={() => { refreshAssets(); onChanged() }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
