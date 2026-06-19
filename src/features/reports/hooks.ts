import { useCallback, useEffect, useState } from 'react'
import { listAgencyReports, listClientReports } from './api'
import type { Report } from '@/types'

export function useAgencyReports(clientId?: string) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try { setError(null); setReports(await listAgencyReports(clientId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load reports') }
    finally { setLoading(false) }
  }, [clientId])

  useEffect(() => { refresh() }, [refresh])
  return { reports, loading, error, refresh }
}

export function useClientReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => { setReports(await listClientReports()); setLoading(false) }, [])
  useEffect(() => { refresh() }, [refresh])
  return { reports, loading, refresh }
}
