import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/brand/AppLoader'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, loading, recovery } = useAuth()
  const location = useLocation()

  if (loading) return <AppLoader />

  // A password-recovery session is authenticated at the Supabase level but
  // must not proceed into the app until the user sets a new password.
  // Checked before `profile` so this can't be bypassed by a stale profile
  // left over from an earlier normal session (see AuthProvider.tsx).
  if (recovery) return <Navigate to="/reset-password" replace />

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
