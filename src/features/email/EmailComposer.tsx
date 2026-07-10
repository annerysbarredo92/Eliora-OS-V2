import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { sendEmail } from './api'

export interface ContactOption {
  email: string
  name: string
  contactId: string
  isPrimary: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  /** Direct prefill — used when launched from a specific contact card. */
  prefill?: { email: string; name?: string; contactId?: string }
  /** Contact list — when provided, shows a dropdown and auto-selects the primary. */
  contacts?: ContactOption[]
  clientId: string
  agencyId: string
  actorId: string
  /** Fires after the user clicks Done on the success screen. */
  onSent?: () => void
}

export function EmailComposer({
  open, onClose, prefill, contacts, clientId, agencyId, onSent,
}: Props) {
  const [to,                  setTo]                  = useState('')
  const [recipientName,       setRecipientName]       = useState<string | undefined>(undefined)
  const [recipientContactId,  setRecipientContactId]  = useState<string | undefined>(undefined)
  const [subject,             setSubject]             = useState('')
  const [body,                setBody]                = useState('')
  const [sending,             setSending]             = useState(false)
  const [error,               setError]               = useState<string | null>(null)
  const [sent,                setSent]                = useState(false)

  const contactsWithEmail = (contacts ?? []).filter(c => !!c.email)
  const useDropdown = contactsWithEmail.length > 0 && !prefill

  // Re-initialise when the modal opens
  useEffect(() => {
    if (!open) return
    if (prefill) {
      setTo(prefill.email)
      setRecipientName(prefill.name)
      setRecipientContactId(prefill.contactId)
    } else if (contactsWithEmail.length > 0) {
      const primary = contactsWithEmail.find(c => c.isPrimary) ?? contactsWithEmail[0]
      setTo(primary.email)
      setRecipientName(primary.name)
      setRecipientContactId(primary.contactId)
    } else {
      setTo('')
      setRecipientName(undefined)
      setRecipientContactId(undefined)
    }
    setSubject('')
    setBody('')
    setError(null)
    setSent(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    if (sending) return
    if (sent) onSent?.()
    onClose()
  }

  function handleContactSelect(contactId: string) {
    const c = contactsWithEmail.find(x => x.contactId === contactId)
    if (!c) return
    setTo(c.email)
    setRecipientName(c.name)
    setRecipientContactId(c.contactId)
  }

  async function send() {
    const toTrimmed      = to.trim()
    const subjectTrimmed = subject.trim()
    const bodyTrimmed    = body.trim()

    if (!toTrimmed)      { setError('To address is required');   return }
    if (!subjectTrimmed) { setError('Subject is required');      return }
    if (!bodyTrimmed)    { setError('Message body is required'); return }

    setSending(true); setError(null)
    try {
      await sendEmail({
        to_email:   toTrimmed,
        to_name:    recipientName,
        subject:    subjectTrimmed,
        body_text:  bodyTrimmed,
        agency_id:  agencyId,
        client_id:  clientId,
        contact_id: recipientContactId,
      })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Send Email"
      subtitle={prefill?.name ? `To: ${prefill.name}` : undefined}
      width={540}
      footer={
        sent ? (
          <Button variant="primary" size="sm" onClick={close}>Done</Button>
        ) : (
          <>
            {error && (
              <p style={{ fontSize: 12, color: 'var(--danger)', flex: 1, alignSelf: 'center' }}>{error}</p>
            )}
            <Button variant="ghost" size="sm" onClick={close} disabled={sending}>Cancel</Button>
            <Button
              variant="primary" size="sm" onClick={send} loading={sending}
              disabled={!to.trim() || !subject.trim() || !body.trim()}
            >
              Send Email
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--lavender-soft)', display: 'grid',
            placeItems: 'center', margin: '0 auto 16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Email sent</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
            Your email to <strong>{to}</strong> was sent via Resend and saved to the Email history.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* To: dropdown (contact-aware) or freeform input */}
          {useDropdown ? (
            <div>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: 'var(--ink-2)', marginBottom: 6,
              }}>
                To *
              </label>
              <select
                value={recipientContactId ?? ''}
                onChange={e => handleContactSelect(e.target.value)}
                disabled={sending}
                style={{
                  width: '100%', padding: '9px 12px', fontSize: 13.5,
                  fontFamily: 'var(--font-sans)', color: 'var(--ink)',
                  background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
                  borderRadius: 10, cursor: 'pointer', outline: 'none',
                  appearance: 'none' as const,
                }}
              >
                {contactsWithEmail.map(c => (
                  <option key={c.contactId} value={c.contactId}>
                    {c.name} — {c.email}{c.isPrimary ? ' (Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Input
              label="To *"
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="contact@company.com"
              disabled={sending}
            />
          )}

          <Input
            label="Subject *"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject line…"
            disabled={sending}
          />
          <Textarea
            label="Message *"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message…"
            rows={6}
            disabled={sending}
          />
          <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            Sent from your agency's verified email address via Resend. A record is saved in the Email history.
          </p>
        </div>
      )}
    </Modal>
  )
}
