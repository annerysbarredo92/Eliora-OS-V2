import { useCallback, useEffect, useState } from 'react'
import { listDiscoveryNotes } from './notes-api'
import type { DiscoveryNote } from '@/types'

export function useDiscoveryNotes(clientId: string) {
  const [notes, setNotes]     = useState<DiscoveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setNotes(await listDiscoveryNotes(clientId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load discovery notes')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { notes, loading, error, refresh: load }
}
