import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import * as TK from '@/features/tasks/api'
import { TASK_STATUSES, PRIORITY_BADGE } from '@/features/tasks/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Task, TaskStatus, TaskPriority } from '@/types'

export function AgencyTasks() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null

  const load = useCallback(async () => { try { setTasks(await TK.listTasks()) } catch { /* */ } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  const clientName = (id: string | null) => id ? (clients.find(c => c.id === id)?.business_name ?? '') : ''

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Tasks</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Internal agency task board.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New task</Button>
      </div>

      {loading ? <div style={{ height: 200, borderRadius: 16, background: 'var(--lavender-soft)', opacity: 0.4 }} /> : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
          {TASK_STATUSES.map(s => {
            const col = tasks.filter(t => t.status === s.value)
            return (
              <div key={s.value} style={{ minWidth: 240, flex: '0 0 240px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{s.label}</span><Badge variant="default">{col.length}</Badge></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.map(t => (
                    <div key={t.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 12 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</p>
                      {clientName(t.client_id) && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{clientName(t.client_id)}</p>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                        <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                        <div style={{ width: 130 }}><Select value={t.status} onChange={e => TK.setTaskStatus(t, e.target.value as TaskStatus).then(load)} options={TASK_STATUSES} /></div>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {ctx && <CreateTask open={showCreate} clients={clients} onClose={() => setShowCreate(false)} onCreated={load} ctx={ctx} />}
    </div>
  )
}

function CreateTask({ open, clients, onClose, onCreated, ctx }: { open: boolean; clients: import('@/types').Client[]; onClose: () => void; onCreated: () => void; ctx: { agencyId: string; actorId: string } }) {
  const [v, setV] = useState({ title: '', description: '', priority: 'medium' as TaskPriority, due_date: '', client_id: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setV({ title: '', description: '', priority: 'medium', due_date: '', client_id: '' }) }, [open])
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!v.title.trim()) return; setBusy(true); try { await TK.createTask({ ...v, client_id: v.client_id || null, assigned_to: ctx.actorId }, ctx); onCreated(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title="New task" width={480} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="task-new" loading={busy}>Create</Button></>}>
      <form id="task-new" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Title" value={v.title} onChange={e => setV(s => ({ ...s, title: e.target.value }))} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Select label="Priority" value={v.priority} onChange={e => setV(s => ({ ...s, priority: e.target.value as TaskPriority }))} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
          <Input label="Due date" type="date" value={v.due_date} onChange={e => setV(s => ({ ...s, due_date: e.target.value }))} />
        </div>
        <Select label="Client (optional)" value={v.client_id} onChange={e => setV(s => ({ ...s, client_id: e.target.value }))} options={[{ value: '', label: 'None' }, ...clients.map(c => ({ value: c.id, label: c.business_name }))]} />
        <Textarea label="Description" value={v.description} onChange={e => setV(s => ({ ...s, description: e.target.value }))} rows={2} />
      </form>
    </Modal>
  )
}
