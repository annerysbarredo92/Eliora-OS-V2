import { useEffect, useState, useCallback } from 'react'
import * as N from '@/features/notifications/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { relativeTime } from '@/features/clients/helpers'
import type { Notification } from '@/types'

const FILTERS = [
  { id: 'all',      label: 'All'              },
  { id: 'unread',   label: 'Unread'           },
  { id: 'action',   label: 'Action Required'  },
  { id: 'message',  label: 'Messages'         },
  { id: 'approval', label: 'Approvals'        },
  { id: 'request',  label: 'Requests'         },
  { id: 'task',     label: 'Tasks'            },
  { id: 'report',   label: 'Reports'          },
  { id: 'billing',  label: 'Billing'          },
  { id: 'system',   label: 'System'           },
]

const EMPTY_STATES: Record<string, string> = {
  unread:   'Nothing unread. You\'re all caught up.',
  action:   'No action items right now. When something needs your attention, it will appear here.',
  message:  'No messages yet. When a client or team member sends a message, it will appear here.',
  approval: 'No approvals pending. When a client requests a revision or approves content, it will appear here.',
  request:  'No client requests. When a client submits a request, it will appear here.',
  task:     'No task notifications. When a task is assigned or updated, it will appear here.',
  report:   'No report notifications. When a report is shared or commented on, it will appear here.',
  billing:  'No billing notifications. When an invoice is due or paid, it will appear here.',
  system:   'No system alerts. You\'re good.',
  all:      'You\'re all caught up. Nothing to see here.',
}

export function AgencyInbox() {
  const [items, setItems]   = useState<Notification[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setItems(await N.listNotifications())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const shown = items.filter(n => {
    if (filter === 'all')      return true
    if (filter === 'unread')   return !n.is_read
    if (filter === 'action')   return (n.type || '').includes('action') || (n.type || '').includes('approval')
    return (n.type || '').includes(filter)
  })
  const unreadCount = items.filter(n => !n.is_read).length
  const unreadIds   = items.filter(n => !n.is_read).map(n => n.id)

  async function read(id: string) { await N.markRead(id); await load() }
  async function readAll() { await N.markAllRead(unreadIds); await load() }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Inbox</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{unreadCount > 0 ? `${unreadCount} unread` : 'You\'re all caught up'}</p>
        </div>
        {unreadIds.length > 0 && (
          <Button variant="outline" size="sm" onClick={readAll}>Mark all read</Button>
        )}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1px solid',
              borderColor: filter === f.id ? 'var(--violet)' : 'var(--hairline)',
              background:  filter === f.id ? 'var(--violet)' : 'var(--surface-solid)',
              color:       filter === f.id ? '#fff' : 'var(--ink-2)',
              transition: 'all 120ms ease',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ height: 200, borderRadius: 16, background: 'var(--lavender-soft)', opacity: 0.4 }} />
      ) : shown.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '52px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>All clear</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
            {EMPTY_STATES[filter] ?? EMPTY_STATES.all}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && read(n.id)}
              style={{
                background: n.is_read ? 'var(--surface-solid)' : 'var(--lavender-soft)',
                border: '1px solid var(--hairline)', borderRadius: 14, padding: '13px 15px',
                cursor: n.is_read ? 'default' : 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                transition: 'background 120ms ease',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: n.is_read ? 500 : 700, color: 'var(--ink)' }}>{n.title}</p>
                {n.body && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{n.body}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {!n.is_read && <Badge variant="brand">New</Badge>}
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{relativeTime(n.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
