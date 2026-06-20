import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import * as TK from '@/features/tasks/api'
import { EVENT_TYPE_LABEL } from '@/features/tasks/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ActiveToggle } from '@/features/operations/components/ServiceModal'
import type { CalendarEvent, CalendarEventType } from '@/types'

export function AgencyCalendar() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null

  const load = useCallback(async () => { try { setEvents(await TK.listEvents()) } catch { /* */ } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  // group by date (agenda view)
  const groups = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = e.start_at ? new Date(e.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Unscheduled'
    ;(acc[key] = acc[key] ?? []).push(e); return acc
  }, {})

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Calendar</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Content schedule, meetings, and deadlines (agenda view).</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>Schedule</Button>
      </div>

      {loading ? <div style={{ height: 200, borderRadius: 16, background: 'var(--lavender-soft)', opacity: 0.4 }} /> : events.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '44px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Nothing scheduled yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.entries(groups).map(([date, evs]) => (
            <div key={date}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 8 }}>{date}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {evs.map(e => (
                  <div key={e.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{e.title}</p><p style={{ fontSize: 12, color: 'var(--muted)' }}>{e.start_at ? new Date(e.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All day'}{e.is_client_visible ? ' · client-visible' : ''}</p></div>
                    <Badge variant="default">{EVENT_TYPE_LABEL[e.type]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>Month grid + drag-and-drop scheduling arrives in a later pass.</p>

      {ctx && <CreateEvent open={showCreate} clients={clients} onClose={() => setShowCreate(false)} onCreated={load} ctx={ctx} />}
    </div>
  )
}

function CreateEvent({ open, clients, onClose, onCreated, ctx }: { open: boolean; clients: import('@/types').Client[]; onClose: () => void; onCreated: () => void; ctx: { agencyId: string; actorId: string } }) {
  const [v, setV] = useState({ title: '', type: 'content' as CalendarEventType, start_at: '', client_id: '', is_client_visible: false, notes: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setV({ title: '', type: 'content', start_at: '', client_id: '', is_client_visible: false, notes: '' }) }, [open])
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!v.title.trim()) return; setBusy(true); try { await TK.createEvent({ ...v, client_id: v.client_id || null }, ctx); onCreated(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title="Schedule" width={480} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="ev-new" loading={busy}>Schedule</Button></>}>
      <form id="ev-new" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Title" value={v.title} onChange={e => setV(s => ({ ...s, title: e.target.value }))} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Select label="Type" value={v.type} onChange={e => setV(s => ({ ...s, type: e.target.value as CalendarEventType }))} options={(Object.keys(EVENT_TYPE_LABEL) as CalendarEventType[]).map(t => ({ value: t, label: EVENT_TYPE_LABEL[t] }))} />
          <Input label="When" type="datetime-local" value={v.start_at} onChange={e => setV(s => ({ ...s, start_at: e.target.value }))} />
        </div>
        <Select label="Client (optional)" value={v.client_id} onChange={e => setV(s => ({ ...s, client_id: e.target.value }))} options={[{ value: '', label: 'None' }, ...clients.map(c => ({ value: c.id, label: c.business_name }))]} />
        <ActiveToggle checked={v.is_client_visible} onChange={val => setV(s => ({ ...s, is_client_visible: val }))} label="Visible to client" />
        <Textarea label="Notes" value={v.notes} onChange={e => setV(s => ({ ...s, notes: e.target.value }))} rows={2} />
      </form>
    </Modal>
  )
}
