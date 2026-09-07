import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/brand/AppLoader'
import { logLifecycle } from '@/lib/lifecycleDebug' // TEMPORARY — see lifecycleDebug.ts
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, loading, recovery } = useAuth()
  const location = useLocation()

  // TEMPORARY — P1 tab-refocus investigation.
  useEffect(() => {
    logLifecycle('RequireAuth MOUNT')
    return () => logLifecycle('RequireAuth UNMOUNT')
  }, [])

  if (loading) { logLifecycle('RequireAuth renders AppLoader', { reason: 'loading' }); return <AppLoader /> }

  // A password-recovery session is authenticated at the Supabase level but
  // must not proceed into the app until the user sets a new password.
  // Checked before `profile` so this can't be bypassed by a stale profile
  // left over from an earlier normal session (see AuthProvider.tsx).
  if (recovery) { logLifecycle('RequireAuth redirects', { reason: 'recovery' }); return <Navigate to="/reset-password" replace /> }

  if (!profile) {
    logLifecycle('RequireAuth redirects', { reason: 'no profile', pathname: location.pathname })
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
