import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import * as P from '../api'
import { money } from '@/features/operations/helpers'
import { relativeTime } from '@/features/clients/helpers'
import type { Lead, PipelineStage, LeadNote, LeadActivity } from '@/types'

export function LeadDetail({ lead, stages, ctx, onEdit, onChanged, onClose }: {
  lead: Lead; stages: PipelineStage[]; ctx: { agencyId: string; actorId: string }
  onEdit: () => void; onChanged: () => Promise<void> | void; onClose: () => void
}) {
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [acts, setActs] = useState<LeadActivity[]>([])
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false)
  const [stageId, setStageId] = useState(lead.stage_id ?? '')

  const load = async () => { setNotes(await P.listNotes(lead.id)); setActs(await P.listActivities(lead.id)) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [lead.id])

  async function move(sid: string) {
    setStageId(sid); const s = stages.find(x => x.id === sid); if (!s) return
    await P.moveLeadStage(lead, sid, s.name, ctx); await load(); await onChanged()
  }
  async function postNote() { if (!body.trim()) return; setBusy(true); try { await P.addNote(lead.id, body, ctx); setBody(''); await load(); await onChanged() } finally { setBusy(false) } }
  async function archive() { setBusy(true); try { await P.archiveLead(lead, ctx); await onChanged(); onClose() } finally { setBusy(false) } }

  return (
    <Modal open onClose={onClose} title={lead.business_name} subtitle={lead.name || undefined} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Info label="Value" value={money(lead.estimated_value_cents)} />
          <Info label="Source" value={lead.source || '—'} />
          <Info label="Email" value={lead.email || '—'} />
          <Info label="Phone" value={lead.phone || '—'} />
        </div>
        <div style={{ maxWidth: 240 }}>
          <Select label="Stage" value={stageId} onChange={e => move(e.target.value)} options={stages.map(s => ({ value: s.id, label: s.name }))} />
        </div>
        {lead.notes && <div><p style={k}>Notes</p><p style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{lead.notes}</p></div>}

        <div>
          <p style={k}>Lead notes</p>
          {notes.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notes yet.</p> :
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>{notes.map(n => <li key={n.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 11px' }}><p style={{ fontSize: 13, color: 'var(--ink)' }}>{n.body}</p><p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{relativeTime(n.created_at)}</p></li>)}</ul>}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Textarea label="" value={body} onChange={e => setBody(e.target.value)} placeholder="Add a note…" rows={2} />
            <div style={{ textAlign: 'right' }}><Button variant="outline" size="sm" onClick={postNote} loading={busy} disabled={!body.trim()}>Add note</Button></div>
          </div>
        </div>

        <div>
          <p style={k}>Activity</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>{acts.map(a => <li key={a.id} style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>• {a.description} <span style={{ color: 'var(--muted)' }}>· {relativeTime(a.created_at)}</span></li>)}</ul>
        </div>

        <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--hairline-2)', paddingTop: 14 }}>
          <Button variant="outline" size="sm" onClick={onEdit}>Edit lead</Button>
          <Button variant="ghost" size="sm" onClick={archive} loading={busy}>Archive</Button>
        </div>
      </div>
    </Modal>
  )
}

const k: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }
function Info({ label, value }: { label: string; value: string }) {
  return <div style={{ minWidth: 100 }}><p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>{label}</p><p style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{value}</p></div>
}
