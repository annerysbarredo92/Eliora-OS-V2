import { useCallback, useEffect, useState } from 'react'
import { listGoals, listKpis } from './api'
import type { Goal, Kpi } from '@/types'

export function useGoals(clientId: string) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setGoals(await listGoals(clientId))
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { goals, loading, refresh: load }
}

export function useKpis(clientId: string) {
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setKpis(await listKpis(clientId))
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { kpis, loading, refresh: load }
}
