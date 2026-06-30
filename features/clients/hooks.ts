import { useCallback, useEffect, useState } from 'react'
import { listClients, getClient, computeMetrics } from './api'
import type { Client, DashboardMetrics } from '@/types'

interface UseClientsResult {
  clients: Client[]
  metrics: DashboardMetrics
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useClients(): UseClientsResult {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await listClients()
      setClients(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { clients, metrics: computeMetrics(clients), loading, error, refresh }
}

interface UseClientResult {
  client: Client | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useClient(id: string | undefined): UseClientResult {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      setError(null)
      const data = await getClient(id)
      setClient(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load client')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  return { client, loading, error, refresh }
}
