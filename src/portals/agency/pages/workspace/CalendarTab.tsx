import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent, Client } from '@/types'

interface Props { client: Client }

const EVENT_TYPE_COLOR: Record<string, string> = {
  content:           '#6D3DE6',
  discovery_call:    '#4F8EF7',
  client_meeting:    '#10B981',
  internal_meeting:  '#94A3B8',
  deadline:          '#EF4444',
  invoice_due:       '#F59E0B',
  proposal_expiration: '#F97316',
  task:              '#64748B',
}

export function CalendarTab({ client }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('client_id', client.id)
        .order('start_at', { ascending: true })
      setEvents((data ?? []) as CalendarEvent[])
      setLoading(false)
    }
    load()
  }, [client.id])

  const upcoming  = events.filter(e => e.start_at && new Date(e.start_at) >= new Date())
  const past      = events.filter(e => e.start_at && new Date(e.start_at) < new Date())

  if (loading) return <div style={{ height: 200, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.4 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Section title={`Upcoming (${upcoming.length})`}>
        {upcoming.length === 0
          ? <Empty>No upcoming events for this project.</Empty>
          : <EventList events={upcoming} />}
      </Section>

      {past.length > 0 && (
        <Section title={`Past (${past.length})`}>
          <EventList events={past} muted />
        </Section>
      )}
    </div>
  )
}

function EventList({ events, muted }: { events: CalendarEvent[]; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map(e => {
        const color = EVENT_TYPE_COLOR[e.type] ?? 'var(--violet)'
        return (
          <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 12, opacity: muted ? 0.6 : 1 }}>
            <div style={{ width: 4, borderRadius: 4, background: color, alignSelf: 'stretch', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{e.title}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                {e.type.replace('_', ' ')} ·{' '}
                {e.all_day
                  ? 'All day'
                  : e.start_at
                    ? new Date(e.start_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : '—'}
              </p>
              {e.notes && <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>{e.notes}</p>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
              {e.is_client_visible ? 'Visible' : 'Internal'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '36px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
      {children}
    </div>
  )
}
