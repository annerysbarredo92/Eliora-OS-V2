import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import * as AI from '@/features/ai/api'
import { AiBrief } from '@/features/ai/components/AiBrief'
import { relativeTime } from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import type { AiGeneration, AiSavedOutput } from '@/types'

const TABS = [
  { id: 'brief',          label: 'Daily Brief'       },
  { id: 'business',       label: 'Business AI'       },
  { id: 'marketing',      label: 'Marketing AI'      },
  { id: 'creative',       label: 'Creative AI'       },
  { id: 'digital',        label: 'Digital AI'        },
  { id: 'operations',     label: 'Operations AI'     },
  { id: 'client_success', label: 'Client Success AI' },
  { id: 'insights',       label: 'Insights AI'       },
  { id: 'saved',          label: 'Saved Outputs'     },
  { id: 'history',        label: 'History'           },
]

const SPECIALIST_META: Record<string, { title: string; description: string; examples: string[] }> = {
  business: {
    title: 'Business AI',
    description: 'Strategy, positioning, pricing, and business development intelligence for your agency.',
    examples: ['Review my agency pricing strategy', 'Help me write a business pitch', 'Analyze my client mix for growth opportunities'],
  },
  marketing: {
    title: 'Marketing AI',
    description: 'Content strategy, campaign planning, captions, hooks, and marketing copy.',
    examples: ['Build a 30-day content plan for a fitness brand', 'Write 5 Instagram hooks for a skincare launch', 'Create a hashtag strategy for a luxury restaurant'],
  },
  creative: {
    title: 'Creative AI',
    description: 'Brand identity, visual direction, creative briefs, and design feedback.',
    examples: ['Write a creative brief for a rebrand', 'Suggest a visual direction for a wellness brand', 'Review and improve this brand positioning statement'],
  },
  digital: {
    title: 'Digital AI',
    description: 'Website copy, funnels, SEO strategy, ads, and digital marketing execution.',
    examples: ['Write homepage copy for a B2B SaaS company', 'Build a landing page conversion framework', 'Review my Google Ads strategy'],
  },
  operations: {
    title: 'Operations AI',
    description: 'SOPs, workflows, onboarding flows, team management, and agency efficiency.',
    examples: ['Create an onboarding SOP for new clients', 'Write a content approval workflow', 'Build a team handoff checklist'],
  },
  client_success: {
    title: 'Client Success AI',
    description: 'Client communication, retention, feedback responses, and relationship management.',
    examples: ['Draft a check-in email for a client who hasn\'t engaged', 'Write a response to client revision feedback', 'Create a client success scorecard'],
  },
  insights: {
    title: 'Insights AI',
    description: 'Performance analysis, reporting summaries, KPI interpretation, and growth insights.',
    examples: ['Summarize this month\'s content performance', 'Identify growth trends from my client data', 'Write an executive summary for a client report'],
  },
}

export function AgencyAiStudio() {
  const { profile } = useAuth()
  const [tab, setTab]       = useState('brief')
  const [history, setHistory] = useState<AiGeneration[]>([])
  const [saved, setSaved]     = useState<AiSavedOutput[]>([])

  const ctx  = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null
  const load = useCallback(async () => {
    setHistory(await AI.listGenerations())
    setSaved(await AI.listSavedOutputs())
  }, [])
  useEffect(() => { load() }, [load])

  const specialistMeta = SPECIALIST_META[tab]

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>AI</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>AI specialists trained on your agency context. Pick one to get started.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 22, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'saved' || t.id === 'history') load() }}
            style={{
              padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--violet)' : 'var(--ink-2)',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: tab === t.id ? '2px solid var(--violet)' : '2px solid transparent',
              marginBottom: -1, letterSpacing: '-0.01em',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Daily Brief — existing AiBrief */}
      {tab === 'brief' && ctx && (
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 22 }}>
          <AiBrief ctx={ctx} />
        </div>
      )}

      {/* Specialist AI tabs */}
      {specialistMeta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Specialist header */}
          <div style={{ background: 'linear-gradient(105deg,#6D3DE6 0%,#9258EE 100%)', borderRadius: 'var(--radius)', padding: '22px 24px', color: '#fff' }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{specialistMeta.title}</p>
            <p style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.6 }}>{specialistMeta.description}</p>
          </div>
          {/* Quick prompts */}
          <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Example Prompts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {specialistMeta.examples.map((ex, i) => (
                <div key={i} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 10, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                  "{ex}"
                </div>
              ))}
            </div>
          </div>
          {/* Coming soon note */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Full specialist coming soon</p>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
              The {specialistMeta.title} will be wired to your agency data — clients, content, reports, and activity — for context-aware answers. In the meantime, use the Daily Brief tab for generation.
            </p>
          </div>
        </div>
      )}

      {/* Saved Outputs */}
      {tab === 'saved' && (
        saved.length === 0 ? <Empty>No saved outputs yet. Generate content and save your favorites here.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {saved.map(s => (
              <div key={s.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</p>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{relativeTime(s.created_at)}</p>
              </div>
            ))}
          </div>
        )
      )}

      {/* History */}
      {tab === 'history' && (
        history.length === 0 ? <Empty>No generation history yet. Outputs from Daily Brief will appear here.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(g => (
              <div key={g.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{(g.brief?.content_type as string) || g.kind}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge variant="default">{g.kind}</Badge>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{relativeTime(g.created_at)}</span>
                  </div>
                </div>
                {Array.isArray((g.result as Record<string, unknown>)?.captions) && (
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    {((g.result as { captions: string[] }).captions[0] ?? '').slice(0, 120)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '52px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}
