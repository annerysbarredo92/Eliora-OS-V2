import { useCallback, useEffect, useState } from 'react'
import {
  ensureOnboarding, seedTemplate, getTemplate, getResponses, getProgress,
  getRequiredItems, getOnboardingActivity,
} from './api'
import type {
  OnboardingTemplate, OnboardingProgress, OnboardingRequiredItem, OnboardingActivity, UserProfile,
} from '@/types'

interface ClientOnboardingData {
  template: OnboardingTemplate | null
  responses: Record<string, unknown>
  progress: OnboardingProgress | null
  requiredItems: OnboardingRequiredItem[]
  loading: boolean
  refresh: () => Promise<void>
}

/** Client side: bootstraps + loads everything needed for the wizard. */
export function useClientOnboarding(user: UserProfile | null): ClientOnboardingData {
  const clientId = user?.client_id ?? null
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [requiredItems, setRequiredItems] = useState<OnboardingRequiredItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    const [t, r, p, i] = await Promise.all([
      getTemplate(), getResponses(clientId), getProgress(clientId), getRequiredItems(clientId),
    ])
    setTemplate(t); setResponses(r); setProgress(p); setRequiredItems(i)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    let active = true
    async function init() {
      if (clientId) await ensureOnboarding(clientId)
      if (active) await refresh()
    }
    init()
    return () => { active = false }
  }, [clientId, refresh])

  return { template, responses, progress, requiredItems, loading, refresh }
}

interface AgencyOnboardingView {
  template: OnboardingTemplate | null
  responses: Record<string, unknown>
  progress: OnboardingProgress | null
  requiredItems: OnboardingRequiredItem[]
  activity: OnboardingActivity[]
  loading: boolean
  refresh: () => Promise<void>
}

/** Agency side: read-only view of a specific client's onboarding. */
export function useAgencyOnboarding(clientId: string | null | undefined): AgencyOnboardingView {
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [requiredItems, setRequiredItems] = useState<OnboardingRequiredItem[]>([])
  const [activity, setActivity] = useState<OnboardingActivity[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    const [t, r, p, i, a] = await Promise.all([
      getTemplate(), getResponses(clientId), getProgress(clientId), getRequiredItems(clientId), getOnboardingActivity(clientId),
    ])
    setTemplate(t); setResponses(r); setProgress(p); setRequiredItems(i); setActivity(a)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    if (clientId) ensureOnboarding(clientId).then(refresh)
  }, [clientId, refresh])

  return { template, responses, progress, requiredItems, activity, loading, refresh }
}

/** Operations Hub: seed + load the agency's default template (read-only view). */
export function useOnboardingTemplate(agencyId: string | null | undefined) {
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function init() {
      if (agencyId) await seedTemplate(agencyId)
      const t = await getTemplate()
      if (active) { setTemplate(t); setLoading(false) }
    }
    init()
    return () => { active = false }
  }, [agencyId])

  return { template, loading }
}
