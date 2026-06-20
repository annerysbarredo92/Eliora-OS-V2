import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { MessageThread } from '@/features/messaging/components/MessageThread'
import * as R from '@/features/requests/api'
import { REQUEST_TYPES, REQUEST_STATUS_META } from '@/features/requests/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { relativeTime } from '@/features/clients/helpers'
import type { ClientRequest, RequestType } from '@/types'

export function ClientMessages() {
  const { profile: user } = useAuth()
  const [tab, setTab] = useState<'messages' | 'requests'>('messages')
  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [showNew, setShowNew] = useState(false)

  const ctx = user?.agency_id && user?.client_id && user?.id
    ? { agencyId: user.agency_id, clientId: user.client_id, actorId: user.id, role: 'client' as const } : null

  const loadReq = useCallback(async () => { if (user?.client_id) setRequests(await R.listRequests(user.client_id)) }, [user?.client_id])
  useEffect(() => { loadReq() }, [loadReq])

  if (!ctx || !user?.client_id) return null

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Messages</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Talk to your team and submit requests.</p>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 20 }}>
        {(['messages', 'requests'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--violet)' : 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--violet)' : '2px solid transparent', marginBottom: -1 }}>{t === 'messages' ? 'Messages' : 'Requests'}</button>
        ))}
      </div>

      {tab === 'messages' ? (
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 18 }}>
          <MessageThread clientId={user.client_id} ctx={ctx} />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}><Button variant="primary" size="sm" onClick={() => setShowNew(true)}>New request</Button></div>
          {requests.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>No requests yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map(r => {
                const m = REQUEST_STATUS_META[r.status]
                return (
                  <div key={r.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</p><p style={{ fontSize: 12, color: 'var(--muted)' }}>{REQUEST_TYPES.find(t => t.value === r.type)?.label} · {relativeTime(r.created_at)}</p></div>
                    <Badge variant={m.badge}>{m.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <NewRequestModal open={showNew} onClose={() => setShowNew(false)} onSubmit={async (type, title, desc) => { await R.createRequest(type, title, desc, ctx); await loadReq() }} />
    </div>
  )
}

function NewRequestModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (type: RequestType, title: string, desc: string) => Promise<void> }) {
  const [type, setType] = useState<RequestType>('content'); const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setType('content'); setTitle(''); setDesc('') } }, [open])
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!title.trim()) return; setBusy(true); try { await onSubmit(type, title, desc); onClose() } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title="New request" width={480} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="req" loading={busy}>Submit</Button></>}>
      <form id="req" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Select label="Type" value={type} onChange={e => setType(e.target.value as RequestType)} options={REQUEST_TYPES} />
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
        <Textarea label="Details" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
      </form>
    </Modal>
  )
}
