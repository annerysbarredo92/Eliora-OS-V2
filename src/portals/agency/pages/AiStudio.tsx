import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import * as AI from '@/features/ai/api'
import { AiBrief } from '@/features/ai/components/AiBrief'
import { relativeTime } from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import type { AiGeneration, AiSavedOutput } from '@/types'

const TABS = [{ id: 'brief', label: 'Brief Builder' }, { id: 'history', label: 'Generation History' }, { id: 'saved', label: 'Saved Outputs' }]

export function AgencyAiStudio() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('brief')
  const [history, setHistory] = useState<AiGeneration[]>([])
  const [saved, setSaved] = useState<AiSavedOutput[]>([])

  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null
  const load = useCallback(async () => { setHistory(await AI.listGenerations()); setSaved(await AI.listSavedOutputs()) }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>AI Studio</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Generate captions, hooks, hashtags, and content plans from a brief.</p>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(t => <button key={t.id} onClick={() => { setTab(t.id); load() }} style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--violet)' : 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: tab === t.id ? '2px solid var(--violet)' : '2px solid transparent', marginBottom: -1 }}>{t.label}</button>)}
      </div>

      {tab === 'brief' && ctx && (
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 22 }}>
          <AiBrief ctx={ctx} />
        </div>
      )}

      {tab === 'history' && (
        history.length === 0 ? <Empty>No generations yet.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(g => (
              <div key={g.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{(g.brief?.content_type as string) || g.kind}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge variant="default">{g.kind}</Badge><span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{relativeTime(g.created_at)}</span></div>
                </div>
                {Array.isArray((g.result as Record<string, unknown>)?.captions) && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{((g.result as { captions: string[] }).captions[0] ?? '').slice(0, 120)}</p>}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'saved' && (
        saved.length === 0 ? <Empty>No saved outputs yet.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {saved.map(s => <div key={s.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px' }}><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</p><p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{relativeTime(s.created_at)}</p></div>)}
          </div>
        )
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '44px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{children}</div> }
