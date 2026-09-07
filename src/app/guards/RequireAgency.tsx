import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isAgencyRole } from '@/lib/auth'
import { AppLoader } from '@/components/brand/AppLoader'
import { logLifecycle } from '@/lib/lifecycleDebug' // TEMPORARY — see lifecycleDebug.ts
import type { ReactNode } from 'react'

export function RequireAgency({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  // TEMPORARY — P1 tab-refocus investigation.
  useEffect(() => {
    logLifecycle('RequireAgency MOUNT')
    return () => logLifecycle('RequireAgency UNMOUNT')
  }, [])

  // Wait for the shared auth state to resolve before deciding anything.
  // Without this a freshly-signed-up user is bounced to /login on first render.
  if (loading) { logLifecycle('RequireAgency renders AppLoader', { reason: 'loading' }); return <AppLoader /> }

  if (!profile) { logLifecycle('RequireAgency redirects', { reason: 'no profile' }); return <Navigate to="/login" replace /> }

  if (profile.role === 'client_user') {
    logLifecycle('RequireAgency redirects', { reason: 'client_user role' })
    return <Navigate to="/portal" replace />
  }

  if (!isAgencyRole(profile.role)) {
    logLifecycle('RequireAgency redirects', { reason: 'not an agency role', role: profile.role })
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
