import { useEffect, useState, useCallback } from 'react'
import { ensureThread, listAllKindMessages, sendMessage } from '@/features/messaging/api'
import { listEmailMessages } from '@/features/email/api'
import { relativeTime } from '@/features/clients/helpers'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { EmailComposer, type ContactOption } from '@/features/email/EmailComposer'
import type { Client, Message, MessageKind, EmailMessage } from '@/types'

const KINDS: { id: MessageKind; label: string; agency_only?: boolean }[] = [
  { id: 'chat',          label: 'Conversation'  },
  { id: 'meeting_note',  label: 'Meeting Notes' },
  { id: 'announcement',  label: 'Announcements' },
  { id: 'internal_note', label: 'Internal Notes', agency_only: true },
]

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

type ActiveTab = MessageKind | 'email'

export function CommunicationTab({ client, ctx }: Props) {
  const [tab, setTab]           = useState<ActiveTab>('chat')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [emails, setEmails]     = useState<EmailMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)

  const msgCtx = { agencyId: ctx.agencyId, clientId: client.id, actorId: ctx.actorId, role: 'agency' as const }

  const contacts: ContactOption[] = (client.client_contacts ?? [])
    .filter(c => !!c.email)
    .map(c => ({
      email:     c.email!,
      name:      `${c.first_name} ${c.last_name}`.trim(),
      contactId: c.id,
      isPrimary: c.is_primary,
    }))

  const loadMessages = useCallback(async () => {
    setLoading(true)
    const tid = await ensureThread(client.id)
    setThreadId(tid)
    if (tid && tab !== 'email') {
      setMessages(await listAllKindMessages(tid, tab as MessageKind))
    }
    if (tab === 'email') {
      setEmails(await listEmailMessages(client.id))
    }
    setLoading(false)
  }, [client.id, tab])

  useEffect(() => { loadMessages() }, [loadMessages])

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 20, overflowX: 'auto' }}>
        {(KINDS as { id: ActiveTab; label: string; agency_only?: boolean }[]).concat([{ id: 'email', label: 'Email' }]).map(k => (
          <button key={k.id} onClick={() => setTab(k.id)} style={{
            padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
            fontWeight: tab === k.id ? 600 : 400,
            color: tab === k.id ? (k.agency_only ? '#EF4444' : 'var(--violet)') : 'var(--ink-2)',
            background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            borderBottom: tab === k.id ? `2px solid ${k.agency_only ? '#EF4444' : 'var(--violet)'}` : '2px solid transparent',
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {k.label}
            {k.agency_only && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#EF4444', background: '#FEE2E2', padding: '2px 5px', borderRadius: 4 }}>
                Private
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 200, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.4 }} />
      ) : tab === 'email' ? (
        <EmailChannel
          emails={emails}
          contacts={contacts}
          client={client}
          ctx={ctx}
          composerOpen={composerOpen}
          onOpenComposer={() => setComposerOpen(true)}
          onComposerClose={() => setComposerOpen(false)}
          onSent={loadMessages}
        />
      ) : (
        <KindPanel
          kind={tab as MessageKind}
          messages={messages}
          threadId={threadId}
          ctx={msgCtx}
          onSent={loadMessages}
        />
      )}
    </div>
  )
}

/* ── Email channel ──────────────────────────────────────────────────────────── */

function EmailChannel({
  emails, contacts, client, ctx,
  composerOpen, onOpenComposer, onComposerClose, onSent,
}: {
  emails: EmailMessage[]
  contacts: ContactOption[]
  client: Client
  ctx: { agencyId: string; actorId: string }
  composerOpen: boolean
  onOpenComposer: () => void
  onComposerClose: () => void
  onSent: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" size="sm" onClick={onOpenComposer}>
          + Compose Email
        </Button>
      </div>

      {/* History */}
      {emails.length === 0 ? (
        <Empty>No emails sent yet. Click "Compose Email" to send the first one.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {emails.map(e => <EmailHistoryCard key={e.id} email={e} />)}
        </div>
      )}

      {/* Composer */}
      <EmailComposer
        open={composerOpen}
        onClose={onComposerClose}
        contacts={contacts}
        clientId={client.id}
        agencyId={ctx.agencyId}
        actorId={ctx.actorId}
        onSent={onSent}
      />
    </div>
  )
}

function EmailHistoryCard({ email }: { email: EmailMessage }) {
  return (
    <div style={{
      background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
      borderRadius: 12, padding: '13px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email.subject}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            To: {email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email}
          </p>
          {email.body_text && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {email.body_text}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <EmailStatusPill status={email.status} />
          <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {relativeTime(email.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#F3F4F6', color: '#6B7280', label: 'Draft'     },
  sent:      { bg: '#EDE9FE', color: '#7C3AED', label: 'Sent'      },
  delivered: { bg: '#D1FAE5', color: '#065F46', label: 'Delivered' },
  opened:    { bg: '#DBEAFE', color: '#1D4ED8', label: 'Opened'    },
  clicked:   { bg: '#D1FAE5', color: '#065F46', label: 'Clicked'   },
  bounced:   { bg: '#FEE2E2', color: '#B91C1C', label: 'Bounced'   },
  failed:    { bg: '#FEE2E2', color: '#B91C1C', label: 'Failed'    },
}

function EmailStatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.sent
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px',
      borderRadius: 999, background: s.bg, color: s.color,
      letterSpacing: '0.03em',
    }}>
      {s.label}
    </span>
  )
}

/* ── Messaging kind panel ───────────────────────────────────────────────────── */

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

  const needsSubject = kind === 'announcement' || kind === 'meeting_note'
  const placeholder: Record<MessageKind, string> = {
    chat:          'Write a message…',
    email:         '',
    meeting_note:  'Write meeting notes…',
    announcement:  'Write announcement…',
    internal_note: 'Write internal note (never visible to client)…',
  }
  const sendLabel: Record<MessageKind, string> = {
    chat:          'Send',
    email:         '',
    meeting_note:  'Save Note',
    announcement:  'Post',
    internal_note: 'Save Note',
  }

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

      {/* Compose */}
      {isInternal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 500 }}>Internal only — never visible to the client</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {needsSubject && (
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={kind === 'announcement' ? 'Announcement title…' : 'Note title…'}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)',
              color: 'var(--ink)', background: 'var(--surface-solid)',
              border: '1px solid var(--hairline)', borderRadius: 10, outline: 'none',
            }}
          />
        )}
        <Textarea label="" value={body} onChange={e => setBody(e.target.value)} placeholder={placeholder[kind]} rows={3} />
        <div style={{ textAlign: 'right' }}>
          <Button variant={isInternal ? 'ghost' : 'primary'} size="sm" onClick={send} loading={busy} disabled={!body.trim()}>
            {sendLabel[kind]}
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
          <p style={{ fontSize: 10.5, marginTop: 3, color: mine ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}>
            {mine ? 'Agency' : 'Client'} · {relativeTime(message.created_at)}
          </p>
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
        {message.kind === 'internal_note' && (
          <span style={{ marginLeft: 8, color: '#EF4444', fontWeight: 600 }}>Internal only</span>
        )}
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
