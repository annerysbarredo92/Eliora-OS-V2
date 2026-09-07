import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/brand/AppLoader'
import { logLifecycle } from '@/lib/lifecycleDebug' // TEMPORARY — see lifecycleDebug.ts
import type { ReactNode } from 'react'

export function RequireClient({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  // TEMPORARY — P1 tab-refocus investigation.
  useEffect(() => {
    logLifecycle('RequireClient MOUNT')
    return () => logLifecycle('RequireClient UNMOUNT')
  }, [])

  // Wait for the shared auth state to resolve before deciding anything.
  if (loading) { logLifecycle('RequireClient renders AppLoader', { reason: 'loading' }); return <AppLoader /> }

  if (!profile) { logLifecycle('RequireClient redirects', { reason: 'no profile' }); return <Navigate to="/login" replace /> }

  if (profile.role !== 'client_user') {
    logLifecycle('RequireClient redirects', { reason: 'not client_user', role: profile.role })
    return <Navigate to="/agency" replace />
  }

  return <>{children}</>
}
