import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { Client } from '@/types'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const QUICK_ACTIONS = [
  { label: 'Summarize Client',  query: 'Give me a concise summary of this client — their stage, key info, recent activity, and where we are in the process.' },
  { label: 'Analyze Health',    query: 'Analyze the current health and risk factors for this project. What should I be watching out for?' },
  { label: 'Prepare Meeting',   query: 'Prepare a meeting brief for my next call with this client. Include context, talking points, and questions to ask.' },
  { label: 'Generate Strategy', query: 'Based on this client\'s discovery data, what content strategy would you recommend for them?' },
  { label: 'Next Steps',        query: 'What are the recommended next steps for this project given where we are in the pipeline?' },
  { label: 'Draft Follow-Up',   query: 'Draft a professional follow-up email I can send to this client based on our recent activity.' },
]

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function AiTab({ client, ctx }: Props) {
  const [history, setHistory]   = useState<ChatMessage[]>([])
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
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
      const { data, error: fnErr } = await supabase.functions.invoke('ai-project', {
        body: { project_id: client.id, query: text },
      })
      if (fnErr || !data?.answer) throw new Error(fnErr?.message ?? 'No response from AI')
      setHistory(h => [...h, { role: 'assistant', content: data.answer }])
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
          Fully wired to {client.business_name}'s data — lead info, discovery, proposals, content, messages, activity.
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
                <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: m.role === 'assistant' ? 'var(--font-mono, monospace)' : 'var(--font-sans)' }}>
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

      {/* Error */}
      {error && (
        <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '10px 14px', borderRadius: 10 }}>
          {error}
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
            <button onClick={() => setHistory([])} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
