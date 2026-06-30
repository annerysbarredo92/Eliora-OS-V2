import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listProjects, getPipelineSummary, getProjectStages } from './api'
import type { Client, PipelineStage } from '@/types'
import type { StageSummary } from './api'

export function useProjects() {
  const [projects, setProjects] = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setProjects(await listProjects()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { projects, loading, error, refresh }
}

export function useProjectStages() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null

  const [stages, setStages]   = useState<PipelineStage[]>([])
  const [summary, setSummary] = useState<StageSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!agencyId) return
    const [s, sm] = await Promise.all([
      getProjectStages(agencyId),
      getPipelineSummary(agencyId),
    ])
    setStages(s)
    setSummary(sm)
    setLoading(false)
  }, [agencyId])

  useEffect(() => { refresh() }, [refresh])
  return { stages, summary, loading, refresh }
}
