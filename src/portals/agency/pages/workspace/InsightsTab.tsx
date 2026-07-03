import { ReportsTab } from './ReportsTab'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function InsightsTab({ client, ctx }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ReportsTab client={client} ctx={ctx} />

      {/* Analytics placeholder */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Analytics</h3>
        <div style={{ padding: '28px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
            Channel performance, reach, engagement, and growth metrics will appear here once data connections are set up.
          </p>
        </div>
      </div>
    </div>
  )
}
