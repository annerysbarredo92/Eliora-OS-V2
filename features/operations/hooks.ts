import { useCallback, useEffect, useState } from 'react'
import { ensureSetup, getSteps, getProgress, listServices, listPackages } from './api'
import type { AgencySetupStep, AgencyOnboardingProgress, Service, Package } from '@/types'

/** Seeds setup on first load, then exposes steps + progress with a refresh. */
export function useSetup(agencyId: string | null | undefined) {
  const [steps, setSteps] = useState<AgencySetupStep[]>([])
  const [progress, setProgress] = useState<AgencyOnboardingProgress | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([getSteps(), getProgress()])
    setSteps(s)
    setProgress(p)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    async function init() {
      if (agencyId) await ensureSetup(agencyId)
      if (active) await refresh()
    }
    init()
    return () => { active = false }
  }, [agencyId, refresh])

  return { steps, progress, loading, refresh }
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setServices(await listServices())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { services, loading, error, refresh }
}

export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setPackages(await listPackages())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { packages, loading, error, refresh }
}
