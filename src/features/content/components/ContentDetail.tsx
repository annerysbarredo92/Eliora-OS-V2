import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { listComments, listApprovals, addComment, setContentStatus, clientDecision } from '../api'
import { STATUS_META, typeLabel, platformLabel, AGENCY_STATUS_OPTIONS } from '../helpers'
import { relativeTime } from '@/features/clients/helpers'
import type { ContentItem, ContentComment, ContentApproval } from '@/types'
import type { ContentCtx } from '../api'

interface ContentDetailProps {
  content: ContentItem
  role: 'agency' | 'client'
  ctx: ContentCtx
  onChanged: () => Promise<void> | void
  onClose: () => void
}

export function ContentDetail({ content, role, ctx, onChanged, onClose }: ContentDetailProps) {
  const [comments, setComments] = useState<ContentComment[]>([])
  const [approvals, setApprovals] = useState<ContentApproval[]>([])
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [decisionNote, setDecisionNote] = useState('')
  const [newStatus, setNewStatus] = useState(content.status)

  const load = async () => {
    setComments(await listComments(content.id, role === 'agency'))
    setApprovals(await listApprovals(content.id))
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [content.id])

  async function refreshAll() { await load(); await onChanged() }

  async function postComment() {
    if (!body.trim()) return
    setBusy(true)
    try { await addComment(content, body, ctx, internal); setBody(''); await refreshAll() }
    finally { setBusy(false) }
  }

  async function submitForReview() {
    setBusy(true)
    try { await setContentStatus(content, 'client_review', ctx); await refreshAll(); onClose() }
    finally { setBusy(false) }
  }

  async function applyStatus() {
    setBusy(true)
    try { await setContentStatus(content, newStatus, ctx); await refreshAll(); onClose() }
    finally { setBusy(false) }
  }

  async function decide(action: 'approve' | 'request_changes' | 'reject') {
    setBusy(true)
    try { await clientDecision(content, action, decisionNote, ctx); await refreshAll(); onClose() }
    finally { setBusy(false) }
  }

  const m = STATUS_META[content.status]
  const canClientAct = role === 'client' && content.status === 'client_review'

  return (
    <Modal open onClose={onClose} title={content.title}
      subtitle={`${typeLabel(content.content_type)} · ${platformLabel(content.platform)}`} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant={m.badge}>{m.label}</Badge>
          {content.scheduled_date && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Scheduled {new Date(content.scheduled_date).toLocaleString()}</span>}
        </div>

        {content.caption && <Field label="Caption">{content.caption}</Field>}
        {content.cta && <Field label="CTA">{content.cta}</Field>}
        {content.hashtags && <Field label="Hashtags">{content.hashtags}</Field>}
        {content.client_notes && <Field label="Notes">{content.client_notes}</Field>}
        {role === 'agency' && content.internal_notes && <Field label="Internal notes (agency only)">{content.internal_notes}</Field>}

        {/* Approval history */}
        {approvals.length > 0 && (
          <div>
            <p style={kicker}>Approval history</p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {approvals.map(a => (
                <li key={a.id} style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                  <strong style={{ color: 'var(--ink)' }}>{a.action.replace('_', ' ')}</strong>
                  {a.note ? ` — ${a.note}` : ''} <span style={{ color: 'var(--muted)' }}>· {relativeTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comments */}
        <div>
          <p style={kicker}>Comments</p>
          {comments.length === 0
            ? <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No comments yet.</p>
            : <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {comments.map(c => (
                  <li key={c.id} style={{ background: c.is_internal ? 'var(--warning-bg)' : 'var(--bg)', borderRadius: 12, padding: '9px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: c.author_role === 'client' ? 'var(--violet)' : 'var(--ink-2)' }}>{c.author_role === 'client' ? 'Client' : 'Agency'}{c.is_internal ? ' · internal' : ''}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{relativeTime(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3 }}>{c.body}</p>
                  </li>
                ))}
              </ul>}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Textarea label="" value={body} onChange={e => setBody(e.target.value)} placeholder="Add a comment…" rows={2} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {role === 'agency'
                ? <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> Internal only
                  </label>
                : <span />}
              <Button variant="outline" size="sm" onClick={postComment} loading={busy} disabled={!body.trim()}>Comment</Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
          {role === 'agency' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              {content.status !== 'client_review' && <Button variant="primary" size="sm" onClick={submitForReview} loading={busy}>Send for client review</Button>}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ width: 180 }}>
                  <Select label="Set status" value={newStatus} onChange={e => setNewStatus(e.target.value as ContentItem['status'])} options={AGENCY_STATUS_OPTIONS} />
                </div>
                <Button variant="outline" size="sm" onClick={applyStatus} loading={busy}>Apply</Button>
              </div>
            </div>
          ) : canClientAct ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Textarea label="Note (optional)" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} rows={2} placeholder="Add context for your decision…" />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={() => decide('approve')} loading={busy}>Approve</Button>
                <Button variant="outline" size="sm" onClick={() => decide('request_changes')} loading={busy}>Request changes</Button>
                <Button variant="danger" size="sm" onClick={() => decide('reject')} loading={busy}>Reject</Button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{role === 'client' ? 'No action needed right now.' : ''}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={kicker}>{label}</p>
      <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{children}</p>
    </div>
  )
}

const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }
