import { useCallback, useEffect, useState } from 'react'
import { ensurePortal, getClientProfile, getPortalSettings, getOnboarding, getAgency } from './api'
import type { ClientPortalProfile, ClientPortalSettings, ClientOnboardingProgress, Agency, UserProfile } from '@/types'

interface PortalData {
  profile: ClientPortalProfile | null
  settings: ClientPortalSettings | null
  onboarding: ClientOnboardingProgress | null
  agency: Agency | null
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Loads (and bootstraps on first call) the client portal data for the signed-in
 * client user. `user` is the auth profile (must have client_id + agency_id).
 */
export function useClientPortal(user: UserProfile | null): PortalData {
  const clientId = user?.client_id ?? null
  const agencyId = user?.agency_id ?? null

  const [profile, setProfile] = useState<ClientPortalProfile | null>(null)
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null)
  const [onboarding, setOnboarding] = useState<ClientOnboardingProgress | null>(null)
  const [agency, setAgency] = useState<Agency | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    const [p, s, o] = await Promise.all([
      getClientProfile(clientId), getPortalSettings(clientId), getOnboarding(clientId),
    ])
    setProfile(p); setSettings(s); setOnboarding(o)
    if (agencyId) setAgency(await getAgency(agencyId))
    setLoading(false)
  }, [clientId, agencyId])

  useEffect(() => {
    let active = true
    async function init() {
      if (clientId) await ensurePortal(clientId)   // bootstrap rows + record access
      if (active) await refresh()
    }
    init()
    return () => { active = false }
  }, [clientId, refresh])

  return { profile, settings, onboarding, agency, loading, refresh }
}
