import { ContentTab }  from './ContentTab'
import { CalendarTab } from './CalendarTab'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function MarketingTab({ client, ctx }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <ContentTab client={client} ctx={ctx} />

      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Schedule</p>
        <CalendarTab client={client} />
      </div>
    </div>
  )
}
