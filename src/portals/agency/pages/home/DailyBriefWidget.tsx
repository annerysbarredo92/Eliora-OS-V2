import { useEffect, useState } from 'react'
import { generate } from '@/features/ai/api'
import type { AiGeneration } from '@/types'

interface Props {
  brief:       AiGeneration | null
  /** Agency context passed to the Edge Function as the daily brief prompt. */
  context:     Record<string, unknown>
  agencyId:    string
  actorId:     string
  onGenerated: (g: AiGeneration) => void
}

export function DailyBriefWidget({ brief, context, agencyId, actorId, onGenerated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)
  const [collapsed, setCollapsed]   = useState(false)

  const summary = brief?.result?.summary as string | undefined

  async function triggerGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      const outcome = await generate(context, 1, 'daily_brief', { agencyId, actorId, clientId: null })
      if (outcome.notConfigured) {
        setGenError('AI key not configured — set ANTHROPIC_API_KEY in Supabase secrets.')
        return
      }
      if (outcome.error) { setGenError(outcome.error); return }
      const syntheticGen: AiGeneration = {
        id: '', agency_id: agencyId, client_id: null, actor_id: actorId,
        kind: 'daily_brief', model: outcome.model ?? null,
        brief: context,
        result: outcome.result as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      }
      onGenerated(syntheticGen)
    } finally {
      setGenerating(false)
    }
  }

  // Auto-generate when no brief exists for today
  useEffect(() => {
    if (!brief && !generating) { triggerGenerate() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief])

  const generatedAt = brief?.created_at
    ? new Date(brief.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div style={{
      background: 'linear-gradient(135deg,#1a1040 0%,#2d1b6e 60%,#1e0f4a 100%)',
      border: '1px solid rgba(109,61,230,0.35)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 4px 24px rgba(109,61,230,0.15)',
      padding: '18px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: 0.18, filter: 'blur(60px)', top: -100, right: -60, pointerEvents: 'none' }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: summary && !collapsed ? 12 : 0, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 13, color: 'rgba(165,180,252,0.9)' }}>✦</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(165,180,252,0.8)' }}>AI Daily Brief</span>
          {generatedAt && !generating && (
            <span style={{ fontSize: 9.5, color: 'rgba(165,180,252,0.4)', fontWeight: 500 }}>Generated {generatedAt}</span>
          )}
          {generating && (
            <span style={{ fontSize: 9.5, color: 'rgba(165,180,252,0.5)', fontWeight: 500 }}>Generating…</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {brief && !generating && (
            <button
              onClick={triggerGenerate}
              style={{ fontSize: 10, color: 'rgba(165,180,252,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: '2px 0', transition: 'color 150ms ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(165,180,252,0.85)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(165,180,252,0.5)' }}
            >
              ↻ Regenerate
            </button>
          )}
          {summary && !generating && (
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{ fontSize: 10, color: 'rgba(165,180,252,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'color 150ms ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(165,180,252,0.85)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(165,180,252,0.5)' }}
            >
              {collapsed ? '▾ Show' : '▴ Hide'}
            </button>
          )}
        </div>
      </div>

      {/* Skeleton while generating */}
      {generating && (
        <div style={{ position: 'relative', zIndex: 1, marginTop: 4 }}>
          {[90, 75, 60].map((w, i) => (
            <div key={i} style={{ height: 9, width: `${w}%`, borderRadius: 5, background: 'rgba(165,180,252,0.12)', marginBottom: i < 2 ? 7 : 0 }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!generating && genError && (
        <div style={{ position: 'relative', zIndex: 1, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <p style={{ fontSize: 12.5, color: 'rgba(252,165,165,0.8)', lineHeight: 1.55 }}>{genError}</p>
          <button
            onClick={triggerGenerate}
            style={{ fontSize: 11, color: 'rgba(165,180,252,0.7)', background: 'rgba(109,61,230,0.25)', border: '1px solid rgba(109,61,230,0.35)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Brief content */}
      {!generating && !genError && summary && !collapsed && (
        <p style={{ fontSize: 13, lineHeight: 1.68, color: 'rgba(199,210,254,0.9)', position: 'relative', zIndex: 1, letterSpacing: '-0.01em', marginTop: 0 }}>
          {summary}
        </p>
      )}
    </div>
  )
}
