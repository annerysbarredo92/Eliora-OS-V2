import { ContentTab } from './ContentTab'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function MarketingTab({ client, ctx }: Props) {
  return <ContentTab client={client} ctx={ctx} />
}
