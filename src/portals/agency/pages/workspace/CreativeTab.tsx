import { FilesTab } from './FilesTab'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function CreativeTab({ client, ctx }: Props) {
  return <FilesTab client={client} ctx={ctx} />
}
