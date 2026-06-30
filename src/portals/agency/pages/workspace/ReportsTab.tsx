import { ClientReportsPanel } from '@/features/reports/components/ClientReportsPanel'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function ReportsTab({ client, ctx }: Props) {
  return (
    <ClientReportsPanel
      client={client}
      ctx={{ agencyId: ctx.agencyId, actorId: ctx.actorId }}
    />
  )
}
