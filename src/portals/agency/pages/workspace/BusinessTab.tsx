import { BusinessShell } from './business/BusinessShell'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onRequestAI: () => void
}

export function BusinessTab({ client, ctx, onChanged, onRequestAI }: Props) {
  return <BusinessShell client={client} ctx={ctx} onChanged={onChanged} onRequestAI={onRequestAI} />
}
