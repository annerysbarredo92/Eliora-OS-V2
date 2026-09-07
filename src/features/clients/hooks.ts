import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Identifies the most recent request in flight. `refresh` is called both
  // by the effect below (on every `id` change) and directly by callers
  // (e.g. "reload after archiving") — a plain effect-cleanup `cancelled`
  // flag, the pattern used throughout Digital Workspace, only covers the
  // first case. A monotonically increasing request id covers both call
  // sites uniformly: whichever request is newest when it resolves is the
  // only one allowed to write data/loading/error, so a slower response for
  // a client the user has already navigated away from can never overwrite
  // the client currently being viewed (see useClient stale-response audit
  // finding).
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!id) return
    const requestId = ++requestIdRef.current
    setError(null)
    try {
      const data = await getClient(id)
      if (requestIdRef.current !== requestId) return // superseded by a newer request — ignore
      setClient(data)
    } catch (e) {
      if (requestIdRef.current !== requestId) return // superseded by a newer request — ignore
      setError(e instanceof Error ? e.message : 'Failed to load client')
    } finally {
      if (requestIdRef.current === requestId) setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  return { client, loading, error, refresh }
}
