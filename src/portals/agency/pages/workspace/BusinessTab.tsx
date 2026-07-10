import { BusinessShell } from './business/BusinessShell'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function BusinessTab({ client, ctx, onChanged }: Props) {
  return <BusinessShell client={client} ctx={ctx} onChanged={onChanged} />
}
