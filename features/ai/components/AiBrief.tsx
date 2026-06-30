import { useState } from 'react'
import * as AI from '../api'
import { BRIEF_FIELDS, BATCH_OPTIONS } from '../api'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Brief } from '../api'
import type { AiResult } from '@/types'

interface AiBriefProps {
  ctx: { agencyId: string; actorId: string; clientId?: string | null }
  compact?: boolean
  /** When provided (embedded mode), shows "Use" actions to push values back. */
  onUseCaption?: (caption: string) => void
  onUseHashtags?: (hashtags: string) => void
}

export function AiBrief({ ctx, compact, onUseCaption, onUseHashtags }: AiBriefProps) {
  const [brief, setBrief] = useState<Brief>({})
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AiResult | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function set(k: keyof Brief, v: string) { setBrief(s => ({ ...s, [k]: v })) }

  async function run() {
    setBusy(true); setNotice(null); setResult(null)
    const out = await AI.generate(brief, count, count > 1 ? 'batch' : 'content', ctx)
    if (out.notConfigured) setNotice('AI provider not connected yet. Deploy the ai-generate Edge Function and set ANTHROPIC_API_KEY (see wave-04 README).')
    else if (out.error) setNotice(`Generation error: ${out.error}`)
    else setResult(out.result)
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {BRIEF_FIELDS.map(f => <Input key={f.key} label={f.label} value={brief[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />)}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 200 }}><Select label="Generate" value={String(count)} onChange={e => setCount(Number(e.target.value))} options={BATCH_OPTIONS.map(b => ({ value: String(b.value), label: b.label }))} /></div>
        <Button variant="primary" onClick={run} loading={busy}>✦ Generate</Button>
      </div>

      {notice && <div style={{ fontSize: 13, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(224,162,58,0.25)' }}>{notice}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
          <ResultBlock title="Captions" items={result.captions} onUse={onUseCaption} />
          <ResultBlock title="Hooks" items={result.hooks} onUse={onUseCaption} />
          <ResultBlock title="Hashtags" items={result.hashtags} onUse={onUseHashtags ? (v => onUseHashtags(v)) : undefined} joinUse />
          <ResultBlock title="Content Ideas" items={result.ideas} />
          {result.creative_direction && <div><p style={k}>Creative Direction</p><p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>{result.creative_direction}</p></div>}
          <ResultBlock title="Visual Suggestions" items={result.visual_suggestions} />
        </div>
      )}
    </div>
  )
}

function ResultBlock({ title, items, onUse, joinUse }: { title: string; items: string[]; onUse?: (v: string) => void; joinUse?: boolean }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p style={k}>{title}</p>
        {joinUse && onUse && <button onClick={() => onUse(items.join(' '))} style={useBtn}>Use all</button>}
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, background: 'var(--bg)', borderRadius: 10, padding: '8px 11px' }}>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{it}</span>
            {onUse && !joinUse && <button onClick={() => onUse(it)} style={useBtn}>Use</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

const k: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }
const useBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--violet)', fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0 }
