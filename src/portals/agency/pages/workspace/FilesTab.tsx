import { ClientFilesPanel } from '@/features/files/components/ClientFilesPanel'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function FilesTab({ client, ctx }: Props) {
  return (
    <ClientFilesPanel
      ctx={{ agencyId: ctx.agencyId, clientId: client.id, actorId: ctx.actorId, role: 'agency' }}
    />
  )
}
