import { useEffect, useState, useCallback } from 'react'
import { ensureThread, listMessages, sendMessage } from '../api'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { relativeTime } from '@/features/clients/helpers'
import type { Message } from '@/types'

/** Agency↔client conversation. role distinguishes alignment + author tagging. */
export function MessageThread({ clientId, ctx }: {
  clientId: string
  ctx: { agencyId: string; clientId: string; actorId: string; role: 'agency' | 'client' }
}) {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const tid = await ensureThread(clientId)
    setThreadId(tid)
    if (tid) setMessages(await listMessages(tid))
    setLoading(false)
  }, [clientId])
  useEffect(() => { load() }, [load])

  async function send() {
    if (!body.trim() || !threadId) return
    setBusy(true)
    try { await sendMessage(threadId, body, ctx); setBody(''); setMessages(await listMessages(threadId)) }
    finally { setBusy(false) }
  }

  if (loading) return <div style={{ height: 240, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.4 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', padding: '4px 2px' }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No messages yet. Say hello 👋</p>
        ) : messages.map(m => {
          const mine = m.author_role === ctx.role
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%', background: mine ? 'var(--violet)' : 'var(--surface-solid)', color: mine ? '#fff' : 'var(--ink)', border: mine ? 'none' : '1px solid var(--hairline)', borderRadius: 16, padding: '9px 13px' }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                <p style={{ fontSize: 10.5, marginTop: 3, color: mine ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}>{m.author_role === 'client' ? 'Client' : 'Agency'} · {relativeTime(m.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Textarea label="" value={body} onChange={e => setBody(e.target.value)} placeholder="Write a message…" rows={2} />
        <div style={{ textAlign: 'right' }}><Button variant="primary" size="sm" onClick={send} loading={busy} disabled={!body.trim()}>Send</Button></div>
      </div>
    </div>
  )
}
