import { ActivityTab }  from './ActivityTab'
import { CalendarTab }  from './CalendarTab'
import type { Client }  from '@/types'

interface Props { client: Client }

export function OpsTab({ client }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CalendarTab client={client} />
      <ActivityTab client={client} />
    </div>
  )
}
