import { useCallback, useEffect, useState } from 'react'
import { listCompetitors } from './api'
import type { ClientCompetitor } from '@/types'

export function useCompetitors(clientId: string) {
  const [competitors, setCompetitors] = useState<ClientCompetitor[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCompetitors(await listCompetitors(clientId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load competitors')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { competitors, loading, error, refresh: load }
}
