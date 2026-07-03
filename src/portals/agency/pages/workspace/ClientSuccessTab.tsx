import { MessagesTab } from './MessagesTab'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function ClientSuccessTab({ client, ctx }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <MessagesTab client={client} ctx={ctx} />

      {/* Requests placeholder */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Requests & Approvals</h3>
        <div style={{ padding: '28px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            No requests or approvals yet. When this client submits a request or approves content, it will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
