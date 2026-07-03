import { LeadInfoTab }  from './LeadInfoTab'
import { ProposalTab }  from './ProposalTab'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function BusinessTab({ client, ctx, onChanged }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Business & deal information */}
      <LeadInfoTab client={client} ctx={ctx} onChanged={onChanged} />
      {/* Contract & proposal summary */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>Contracts & Proposals</h3>
        <ProposalTab client={client} ctx={ctx} onChanged={onChanged} />
      </div>
    </div>
  )
}
