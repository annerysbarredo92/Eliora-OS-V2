import { useEffect, useState, useCallback } from 'react'
import * as AU from '@/features/automation/api'
import { TRIGGERS, ACTIONS } from '@/features/automation/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ActiveToggle } from '@/features/operations/components/ServiceModal'
import type { Automation, AutomationTrigger } from '@/types'

export function AutomationsTab({ ctx }: { ctx: { agencyId: string; actorId: string } | null }) {
  const [list, setList] = useState<Automation[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const load = useCallback(async () => { setList(await AU.listAutomations()) }, [])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>If-this-then-that automations. Scheduled triggers run via a scheduler (see wave-04 README); manual run works now.</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} disabled={!ctx}>New automation</Button>
      </div>

      {list.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>No automations yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(a => (
            <div key={a.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>When <strong>{TRIGGERS.find(t => t.value === a.trigger_type)?.label}</strong> → <strong>{ACTIONS.find(x => x.value === a.action_type)?.label ?? a.action_type}</strong></p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge variant={a.is_active ? 'success' : 'default'}>{a.is_active ? 'Active' : 'Paused'}</Badge>
                {ctx && <Button variant="outline" size="sm" onClick={() => AU.runNow(a, ctx).then(load)}>Run now</Button>}
                <ActiveToggle checked={a.is_active} onChange={val => AU.setActive(a, val).then(load)} label="" />
              </div>
            </div>
          ))}
        </div>
      )}

      {ctx && <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} ctx={ctx} />}
    </div>
  )
}

function CreateModal({ open, onClose, onCreated, ctx }: { open: boolean; onClose: () => void; onCreated: () => void; ctx: { agencyId: string; actorId: string } }) {
  const [v, setV] = useState({ name: '', trigger_type: 'date' as AutomationTrigger, action_type: 'invoice_reminder', description: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setV({ name: '', trigger_type: 'date', action_type: 'invoice_reminder', description: '' }) }, [open])
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!v.name.trim()) return; setBusy(true); try { await AU.createAutomation(v, ctx); onCreated(); onClose() } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title="New automation" subtitle="If this → then that" width={480} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="auto-new" loading={busy}>Create</Button></>}>
      <form id="auto-new" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Name" value={v.name} onChange={e => setV(s => ({ ...s, name: e.target.value }))} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Select label="If (trigger)" value={v.trigger_type} onChange={e => setV(s => ({ ...s, trigger_type: e.target.value as AutomationTrigger }))} options={TRIGGERS} />
          <Select label="Then (action)" value={v.action_type} onChange={e => setV(s => ({ ...s, action_type: e.target.value }))} options={ACTIONS} />
        </div>
        <Textarea label="Description" value={v.description} onChange={e => setV(s => ({ ...s, description: e.target.value }))} rows={2} />
      </form>
    </Modal>
  )
}
