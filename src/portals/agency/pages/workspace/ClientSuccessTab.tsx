import { useEffect, useState, useCallback } from 'react'
import { CommunicationTab } from './CommunicationTab'
import { listRequests, setRequestStatus, REQUEST_STATUS_META, REQUEST_TYPES } from '@/features/requests/api'
import { relativeTime } from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import type { Client, ClientRequest, RequestStatus } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

type FilterTab = 'all' | 'open' | 'in_progress' | 'completed'

const FILTER_LABELS: Record<FilterTab, string> = {
  all:         'All',
  open:        'Open',
  in_progress: 'In Progress',
  completed:   'Completed',
}

function matchesFilter(r: ClientRequest, f: FilterTab): boolean {
  if (f === 'all')         return true
  if (f === 'open')        return ['submitted', 'in_review', 'waiting'].includes(r.status)
  if (f === 'in_progress') return r.status === 'in_progress'
  if (f === 'completed')   return ['completed', 'closed'].includes(r.status)
  return true
}

function typeLabel(type: string): string {
  return REQUEST_TYPES.find(t => t.value === type)?.label ?? type
}

export function ClientSuccessTab({ client, ctx }: Props) {
  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterTab>('all')

  const reqCtx = { ...ctx, clientId: client.id, role: 'agency' as const }

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listRequests(client.id)
    setRequests(data)
    setLoading(false)
  }, [client.id])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(r: ClientRequest, status: RequestStatus) {
    await setRequestStatus(r, status, reqCtx)
    setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status } : x))
  }

  const visible = requests.filter(r => matchesFilter(r, filter))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CommunicationTab client={client} ctx={ctx} />

      {/* Requests & Approvals */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Requests & Approvals
          </h3>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(Object.keys(FILTER_LABELS) as FilterTab[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
                  background: filter === f ? 'var(--violet)' : 'var(--surface)',
                  color: filter === f ? '#fff' : 'var(--ink-2)',
                  border: `1px solid ${filter === f ? 'var(--violet)' : 'var(--hairline)'}`,
                  borderRadius: 999, cursor: 'pointer', transition: 'all 140ms ease',
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 68, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              {requests.length === 0
                ? 'No client requests yet. Requests, revisions, and approvals will appear here.'
                : `No ${FILTER_LABELS[filter].toLowerCase()} requests.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(r => {
              const meta = REQUEST_STATUS_META[r.status]
              return (
                <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{r.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {typeLabel(r.type)} · {relativeTime(r.created_at)}
                      </p>
                      {r.description && (
                        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      <select
                        value={r.status}
                        onChange={e => handleStatusChange(r, e.target.value as RequestStatus)}
                        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--surface-solid)', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      >
                        {(Object.keys(REQUEST_STATUS_META) as RequestStatus[]).map(s => (
                          <option key={s} value={s}>{REQUEST_STATUS_META[s].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
