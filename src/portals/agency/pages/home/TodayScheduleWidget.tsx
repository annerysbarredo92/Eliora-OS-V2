import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CalendarEvent, Task, ContentItem, Proposal, Client } from '@/types'

type ScheduleKind = 'meeting' | 'task' | 'content' | 'proposal'

interface ScheduleItem {
  key:        string
  kind:       ScheduleKind
  label:      string
  clientName: string
  time:       Date | null
  href:       string
}

const KIND_COLOR: Record<ScheduleKind, string> = {
  meeting:  '#6d3de6',
  task:     '#d97706',
  content:  '#059669',
  proposal: '#e11d48',
}
const KIND_TAG: Record<ScheduleKind, string> = {
  meeting:  'Meeting',
  task:     'Task',
  content:  'Content',
  proposal: 'Proposal',
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function clientName(clientId: string | null, clients: Client[]): string {
  if (!clientId) return ''
  return clients.find(c => c.id === clientId)?.business_name ?? ''
}

interface Props {
  events:    CalendarEvent[]
  tasks:     Task[]
  content:   ContentItem[]
  proposals: Proposal[]
  clients:   Client[]
  loading:   boolean
}

export function TodayScheduleWidget({ events, tasks, content, proposals, clients, loading }: Props) {
  const navigate = useNavigate()

  const items = useMemo<ScheduleItem[]>(() => {
    const list: ScheduleItem[] = []

    // Calendar events today
    events
      .filter(e => isToday(e.start_at))
      .forEach(e => {
        list.push({
          key: `ev-${e.id}`,
          kind: ['discovery_call','client_meeting'].includes(e.type) ? 'meeting' : 'task',
          label: e.title,
          clientName: clientName(e.client_id, clients),
          time: e.start_at ? new Date(e.start_at) : null,
          href: '/agency/calendar',
        })
      })

    // Tasks due today (not done)
    tasks
      .filter(t => t.status !== 'done' && isToday(t.due_date))
      .forEach(t => {
        list.push({
          key: `tk-${t.id}`,
          kind: 'task',
          label: t.title,
          clientName: clientName(t.client_id, clients),
          time: null,
          href: '/agency/tasks',
        })
      })

    // Content scheduled today
    content
      .filter(ci => isToday(ci.scheduled_date) && !['archived'].includes(ci.status))
      .forEach(ci => {
        list.push({
          key: `ct-${ci.id}`,
          kind: 'content',
          label: ci.title,
          clientName: clientName(ci.client_id, clients),
          time: ci.scheduled_date ? new Date(ci.scheduled_date) : null,
          href: ci.client_id ? `/agency/projects/${ci.client_id}` : '/agency/content',
        })
      })

    // Proposals expiring today
    proposals
      .filter(p => p.expires_at && isToday(p.expires_at) && p.status === 'sent')
      .forEach(p => {
        list.push({
          key: `pr-${p.id}`,
          kind: 'proposal',
          label: p.title,
          clientName: clientName(p.client_id, clients),
          time: null,
          href: p.client_id ? `/agency/projects/${p.client_id}` : '/agency/projects',
        })
      })

    // Sort: timed events first by time, then untimed at end
    return list.sort((a, b) => {
      if (a.time && b.time) return a.time.getTime() - b.time.getTime()
      if (a.time && !b.time) return -1
      if (!a.time && b.time) return 1
      return 0
    })
  }, [events, tasks, content, proposals, clients])

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Today's Schedule</p>

      {loading ? <Skeleton /> : items.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing scheduled today.</p>
        </div>
      ) : (
        <div>
          {items.map(item => (
            <button
              key={item.key}
              onClick={() => navigate(item.href)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                padding: '7px 0', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--hairline)', textAlign: 'left',
                transition: 'background 120ms', fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              {/* Time */}
              <span style={{ fontSize: 10, fontWeight: 600, color: KIND_COLOR[item.kind], width: 42, flexShrink: 0, paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {item.time
                  ? item.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : 'EOD'}
              </span>
              {/* Label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</p>
                {item.clientName && <p style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.clientName}</p>}
              </div>
              {/* Type tag */}
              <span style={{ fontSize: 9.5, fontWeight: 700, color: KIND_COLOR[item.kind], background: `${KIND_COLOR[item.kind]}15`, borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>
                {KIND_TAG[item.kind]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
      {[85, 70, 90].map((w, i) => (
        <div key={i} style={{ height: 34, width: `${w}%`, borderRadius: 8, background: 'var(--lavender-soft)', opacity: 0.45 }} />
      ))}
    </div>
  )
}
