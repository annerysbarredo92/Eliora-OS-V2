import { DigitalShell } from './digital/DigitalShell'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onRequestAI: () => void
}

export function DigitalTab({ client, ctx, onChanged, onRequestAI }: Props) {
  return <DigitalShell client={client} ctx={ctx} onChanged={onChanged} onRequestAI={onRequestAI} />
}
