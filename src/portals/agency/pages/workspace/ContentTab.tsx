import { ClientContentPanel } from '@/features/content/components/ClientContentPanel'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function ContentTab({ client, ctx }: Props) {
  return (
    <ClientContentPanel
      client={client}
      ctx={{ agencyId: ctx.agencyId, actorId: ctx.actorId, role: 'agency' }}
    />
  )
}
