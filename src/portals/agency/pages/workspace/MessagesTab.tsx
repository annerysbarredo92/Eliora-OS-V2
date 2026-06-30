import { useEffect, useState, useCallback } from 'react'
import { ensureThread, listAllKindMessages, sendMessage } from '@/features/messaging/api'
import { relativeTime } from '@/features/clients/helpers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { Client, Message, MessageKind } from '@/types'

const KINDS: { id: MessageKind; label: string; agency_only?: boolean }[] = [
  { id: 'chat',          label: 'Messages'       },
  { id: 'email',         label: 'Emails'         },
  { id: 'meeting_note',  label: 'Meeting Notes'  },
  { id: 'announcement',  label: 'Announcements'  },
  { id: 'internal_note', label: 'Internal Notes', agency_only: true },
]

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function MessagesTab({ client, ctx }: Props) {
  const [kind, setKind]       = useState<MessageKind>('chat')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)

  const msgCtx = { agencyId: ctx.agencyId, clientId: client.id, actorId: ctx.actorId, role: 'agency' as const }

  const load = useCallback(async () => {
    setLoading(true)
    const tid = await ensureThread(client.id)
    setThreadId(tid)
    if (tid) setMessages(await listAllKindMessages(tid, kind))
    setLoading(false)
  }, [client.id, kind])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 20, overflowX: 'auto' }}>
        {KINDS.map(k => (
          <button key={k.id} onClick={() => setKind(k.id)} style={{
            padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
            fontWeight: kind === k.id ? 600 : 400,
            color: kind === k.id ? (k.agency_only ? '#EF4444' : 'var(--violet)') : 'var(--ink-2)',
            background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            borderBottom: kind === k.id ? `2px solid ${k.agency_only ? '#EF4444' : 'var(--violet)'}` : '2px solid transparent',
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {k.label}
            {k.agency_only && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#EF4444', background: '#FEE2E2', padding: '2px 5px', borderRadius: 4 }}>Private</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 200, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.4 }} />
      ) : (
        <KindPanel
          kind={kind}
          messages={messages}
          threadId={threadId}
          ctx={msgCtx}
          onSent={load}
        />
      )}
    </div>
  )
}

function KindPanel({ kind, messages, threadId, ctx, onSent }: {
  kind: MessageKind
  messages: Message[]
  threadId: string | null
  ctx: { agencyId: string; clientId: string; actorId: string; role: 'agency' }
  onSent: () => void
}) {
  const [body, setBody]       = useState('')
  const [subject, setSubject] = useState('')
  const [busy, setBusy]       = useState(false)

  const needsSubject = kind === 'email' || kind === 'announcement' || kind === 'meeting_note'
  const placeholder  = {
    chat:          'Write a message…',
    email:         'Write email body…',
    meeting_note:  'Write meeting notes…',
    announcement:  'Write announcement…',
    internal_note: 'Write internal note (never visible to client)…',
  }[kind]
  const sendLabel = {
    chat:          'Send',
    email:         'Send Email',
    meeting_note:  'Save Note',
    announcement:  'Post',
    internal_note: 'Save Note',
  }[kind]

  async function send() {
    if (!body.trim() || !threadId) return
    setBusy(true)
    try {
      await sendMessage(threadId, body, ctx, kind, needsSubject ? subject : undefined)
      setBody(''); setSubject('')
      onSent()
    } finally { setBusy(false) }
  }

  const isInternal = kind === 'internal_note'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Message list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <Empty>No {kind.replace('_', ' ')}s yet.</Empty>
        ) : messages.map(m => (
          <MessageBubble key={m.id} message={m} kind={kind} />
        ))}
      </div>

      {/* Compose area */}
      {isInternal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 500 }}>Internal only — never visible to the client</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {needsSubject && (
          <Input label={kind === 'email' ? 'Subject' : 'Title'} value={subject} onChange={e => setSubject(e.target.value)} placeholder={kind === 'email' ? 'Email subject…' : 'Note title…'} />
        )}
        <Textarea label="" value={body} onChange={e => setBody(e.target.value)} placeholder={placeholder} rows={3} />
        <div style={{ textAlign: 'right' }}>
          <Button variant={isInternal ? 'ghost' : 'primary'} size="sm" onClick={send} loading={busy} disabled={!body.trim()}>
            {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, kind }: { message: Message; kind: MessageKind }) {
  const mine = message.author_role === 'agency'
  if (kind === 'chat') {
    return (
      <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ maxWidth: '78%', background: mine ? 'var(--violet)' : 'var(--surface-solid)', color: mine ? '#fff' : 'var(--ink)', border: mine ? 'none' : '1px solid var(--hairline)', borderRadius: 16, padding: '9px 13px' }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{message.body}</p>
          <p style={{ fontSize: 10.5, marginTop: 3, color: mine ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}>{mine ? 'Agency' : 'Client'} · {relativeTime(message.created_at)}</p>
        </div>
      </div>
    )
  }
  return (
    <div style={{ background: 'var(--surface-solid)', border: `1px solid ${message.kind === 'internal_note' ? '#FECACA' : 'var(--hairline)'}`, borderRadius: 12, padding: '12px 14px' }}>
      {message.subject && <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{message.subject}</p>}
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{message.body}</p>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        {mine ? 'Agency' : 'Client'} · {relativeTime(message.created_at)}
        {message.kind === 'internal_note' && <span style={{ marginLeft: 8, color: '#EF4444', fontWeight: 600 }}>Internal only</span>}
      </p>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 12 }}>
      {children}
    </div>
  )
}
