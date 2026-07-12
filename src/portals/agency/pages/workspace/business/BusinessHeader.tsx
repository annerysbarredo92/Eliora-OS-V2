import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { EmailComposer, type ContactOption } from '@/features/email/EmailComposer'
import { primaryContact, statusLabel, STATUS_BADGE } from '@/features/clients/helpers'
import { ensureThread, sendMessage } from '@/features/messaging/api'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onRequestAI: () => void
}

export function BusinessHeader({ client, ctx, onRequestAI }: Props) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [noteOpen, setNoteOpen]   = useState(false)
  const [noteBody, setNoteBody]   = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)

  const pc = primaryContact(client)

  const contacts: ContactOption[] = (client.client_contacts ?? [])
    .filter(c => !!c.email)
    .map(c => ({
      email:     c.email!,
      name:      `${c.first_name} ${c.last_name ?? ''}`.trim(),
      contactId: c.id,
      isPrimary: c.is_primary,
    }))

  const prefill = pc?.email ? {
    email:     pc.email,
    name:      `${pc.first_name} ${pc.last_name ?? ''}`.trim(),
    contactId: pc.id,
  } : undefined

  const initials = client.business_name.slice(0, 2).toUpperCase()

  async function saveNote() {
    if (!noteBody.trim()) { setNoteError('Note cannot be empty'); return }
    setNoteSaving(true); setNoteError(null)
    try {
      const tid = await ensureThread(client.id)
      if (!tid) throw new Error('Could not open message thread')
      await sendMessage(tid, noteBody, {
        agencyId: ctx.agencyId,
        clientId: client.id,
        actorId:  ctx.actorId,
        role: 'agency',
      }, 'internal_note', undefined)
      setNoteBody('')
      setNoteOpen(false)
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save note')
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 'var(--header-height)',
          zIndex: 35,
          background: 'rgba(244,242,251,0.92)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          borderBottom: '1px solid var(--hairline-2)',
          padding: '12px 0 12px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--violet), var(--iris))',
            display: 'grid', placeItems: 'center',
            color: '#fff', fontWeight: 700, fontSize: 13,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: 'var(--ink)', letterSpacing: '-0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 260,
              }}>
                {client.business_name}
              </span>
              <Badge variant={STATUS_BADGE[client.status]}>{statusLabel(client.status)}</Badge>
            </div>
            {(client.industry || client.location) && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
                {[client.industry, client.location].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailOpen(true)}
            aria-label="Send email to client"
            className="min-h-[44px]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNoteOpen(true)}
            aria-label="Log an internal note"
            className="min-h-[44px]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Log Note
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRequestAI}
            aria-label="Open AI client brief"
            className="min-h-[44px]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 8v4l3 3" />
              <path d="M16 2v4" /><path d="M20 2v4" /><path d="M16 4h4" />
            </svg>
            AI Brief
          </Button>
        </div>
      </div>

      {/* Email Composer */}
      <EmailComposer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        contacts={contacts.length > 0 ? contacts : undefined}
        prefill={contacts.length === 0 ? prefill : undefined}
        clientId={client.id}
        agencyId={ctx.agencyId}
        actorId={ctx.actorId}
      />

      {/* Quick Note Modal */}
      <Modal
        open={noteOpen}
        onClose={() => { if (!noteSaving) { setNoteOpen(false); setNoteBody(''); setNoteError(null) } }}
        title="Log Internal Note"
        subtitle="Saved as an internal note — never visible to the client."
        width={480}
        footer={
          <>
            {noteError && (
              <p style={{ fontSize: 12, color: 'var(--danger)', flex: 1, alignSelf: 'center' }}>{noteError}</p>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setNoteOpen(false); setNoteBody(''); setNoteError(null) }} disabled={noteSaving} className="min-h-[44px]">
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={saveNote} loading={noteSaving} disabled={!noteBody.trim()} className="min-h-[44px]">
              Save Note
            </Button>
          </>
        }
      >
        <Textarea
          label="Note"
          rows={5}
          value={noteBody}
          onChange={e => { setNoteBody(e.target.value); setNoteError(null) }}
          placeholder="Add a meeting note, call summary, or internal observation…"
        />
      </Modal>
    </>
  )
}
