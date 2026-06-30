import type { ActivityLog } from '@/types'
import { relativeTime } from '@/features/clients/helpers'

const ACTION_DOT: Record<string, string> = {
  'client.created':  'var(--success)',
  'client.updated':  'var(--violet)',
  'client.archived': 'var(--muted)',
  'client.viewed':   'var(--lavender)',
  'invite.clicked':  'var(--gold)',
}

interface ActivityFeedProps {
  items: ActivityLog[]
  loading?: boolean
  emptyLabel?: string
}

export function ActivityFeed({ items, loading, emptyLabel = 'No activity yet.' }: ActivityFeedProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 44, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>
        {emptyLabel}
      </p>
    )
  }

  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map(item => (
        <li key={item.id} style={{ display: 'flex', gap: 12, padding: '10px 4px', alignItems: 'flex-start' }}>
          <span
            style={{
              marginTop: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              background: ACTION_DOT[item.action] ?? 'var(--lavender)',
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>
              {item.description || item.action}
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {relativeTime(item.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
