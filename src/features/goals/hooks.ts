import { useCallback, useEffect, useState } from 'react'
import { listGoals, listKpis } from './api'
import type { Goal, Kpi } from '@/types'

export function useGoals(clientId: string) {
  const [goals, setGoals]     = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGoals(await listGoals(clientId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { goals, loading, error, refresh: load }
}

export function useKpis(clientId: string) {
  const [kpis, setKpis]       = useState<Kpi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setKpis(await listKpis(clientId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load KPIs')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { kpis, loading, error, refresh: load }
}
