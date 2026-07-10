import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { Client } from '@/types'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const QUICK_ACTIONS = [
  { label: 'Summarize Account',      query: "Summarize this client's current situation, stage, health, and the most important details I need to know." },
  { label: 'Identify Risks',         query: 'What are the key risks and concerns for this project right now? What should I be watching closely?' },
  { label: 'Suggest Next Steps',     query: 'Based on where we are, what are the most important next steps for this project?' },
  { label: 'Prepare for Meeting',    query: 'Prepare a brief for my next meeting with this client — context, key talking points, and questions to ask.' },
  { label: 'Generate Opportunities', query: 'Based on what you know about this client, what upsell, expansion, or growth opportunities exist?' },
  { label: 'Draft Client Update',    query: 'Draft a concise, professional update I can send to this client about where we currently stand in the project.' },
]

interface Props { client: Client }

function buildClientBrief(client: Client, question: string): Record<string, unknown> {
  const li = (client.lead_info ?? {}) as Record<string, string>
  const dd = (client.discovery_data ?? {}) as Record<string, string>
  const stage = client.pipeline_stages

  const brief: Record<string, unknown> = {
    question,
    client_name:    client.business_name,
    status:         client.status,
    stage:          stage?.name ?? 'Unknown',
    health:         client.health !== 'unknown' ? client.health : 'Not set',
    industry:       client.industry ?? '',
    location:       client.location ?? '',
    lead_score:     client.lead_score != null ? `${client.lead_score}/100` : '',
    project_value:  client.project_value_cents > 0 ? `$${(client.project_value_cents / 100).toFixed(0)}` : '',
    next_action:    client.next_action ?? '',
    decision_maker: client.decision_maker ?? '',
  }

  // Lead info fields (only include if populated)
  if (li.services_interested)  brief.services_interested  = li.services_interested
  if (li.pain_points)          brief.pain_points          = li.pain_points
  if (li.requirements)         brief.requirements         = li.requirements
  if (li.competitors)          brief.competitors          = li.competitors
  if (li.sales_notes)          brief.sales_notes          = li.sales_notes

  // Discovery context (only include if populated)
  if (dd.target_audience)            brief.target_audience            = dd.target_audience
  if (dd.brand_voice)                brief.brand_voice                = dd.brand_voice
  if (dd.brand_mission)              brief.brand_mission              = dd.brand_mission
  if (dd.current_content_strategy)   brief.current_content_strategy   = dd.current_content_strategy
  if (dd.audience_pain_points)       brief.audience_pain_points       = dd.audience_pain_points

  return brief
}

export function AiTab({ client }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function ask(q: string) {
    const text = q.trim()
    if (!text || loading) return

    setHistory(h => [...h, { role: 'user', content: text }])
    setQuery('')
    setLoading(true)
    setError(null)

    try {
      const brief = buildClientBrief(client, text)
      const { data, error: fnErr } = await supabase.functions.invoke('ai-generate', {
        body: { brief, kind: 'analysis' },
      })

      if (fnErr) throw new Error(fnErr.message)
      if (data?.not_configured) throw new Error('AI is not configured. Please set your Anthropic API key in Supabase Secrets.')
      if (data?.error) throw new Error(data.error)

      const answer = data?.result?.summary as string | undefined
      if (!answer) throw new Error('No response received from AI.')

      setHistory(h => [...h, { role: 'assistant', content: answer }])
    } catch (e) {
      setError((e as Error).message)
      setHistory(h => h.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(query)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(105deg,#6D3DE6 0%,#9258EE 100%)', borderRadius: 'var(--radius)', padding: '18px 20px', color: '#fff' }}>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>AI Project Assistant</p>
        <p style={{ fontSize: 13, opacity: 0.82 }}>
          Wired to {client.business_name}'s data — lead info, discovery, stage, health, and more.
        </p>
      </div>

      {/* Quick actions */}
      {history.length === 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Quick Actions</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.label}
                onClick={() => ask(a.query)}
                disabled={loading}
                style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                  background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
                  borderRadius: 999, cursor: 'pointer', color: 'var(--ink)',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--violet)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--violet)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-solid)'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--hairline)' }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 480, overflowY: 'auto', padding: '4px 2px' }}>
          {history.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6D3DE6,#9258EE)', display: 'grid', placeItems: 'center', fontSize: 13, color: '#fff', flexShrink: 0, marginRight: 10, marginTop: 2 }}>
                  ✦
                </div>
              )}
              <div style={{
                maxWidth: m.role === 'user' ? '75%' : '90%',
                background: m.role === 'user' ? 'var(--violet)' : 'var(--surface-solid)',
                color: m.role === 'user' ? '#fff' : 'var(--ink)',
                border: m.role === 'user' ? 'none' : '1px solid var(--hairline)',
                borderRadius: 16, padding: '11px 15px',
              }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)' }}>
                  {m.content}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6D3DE6,#9258EE)', display: 'grid', placeItems: 'center', fontSize: 13, color: '#fff', flexShrink: 0 }}>✦</div>
              <div style={{ padding: '10px 14px', background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 16, display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error — non-crashing, workspace stays usable */}
      {error && (
        <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Textarea
          label=""
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about this project… (⌘↩ to send)"
          rows={3}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {history.length > 0 && (
            <button onClick={() => { setHistory([]); setError(null) }} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Clear chat
            </button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="primary" size="sm" onClick={() => ask(query)} loading={loading} disabled={!query.trim()}>
              Ask AI
            </Button>
          </div>
        </div>
      </div>

      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
    </div>
  )
}
