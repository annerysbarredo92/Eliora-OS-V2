import { useActivity } from '@/features/activity/hooks'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import type { Client } from '@/types'

interface Props { client: Client }

export function ActivityTab({ client }: Props) {
  const activity = useActivity({ clientId: client.id, limit: 100 })
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
      <ActivityFeed
        items={activity.items}
        loading={activity.loading}
        emptyLabel="No activity recorded for this project yet."
      />
    </div>
  )
}
