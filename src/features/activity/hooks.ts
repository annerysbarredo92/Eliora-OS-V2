import { useCallback, useEffect, useState } from 'react'
import { listActivity } from './api'
import type { ActivityLog } from '@/types'

interface UseActivityResult {
  items: ActivityLog[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useActivity(opts: { clientId?: string; limit?: number } = {}): UseActivityResult {
  const { clientId, limit } = opts
  const [items, setItems] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await listActivity({ clientId, limit })
    setItems(data)
    setLoading(false)
  }, [clientId, limit])

  useEffect(() => { refresh() }, [refresh])

  return { items, loading, refresh }
}
