import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isAgencyRole } from '@/lib/auth'
import { AppLoader } from '@/components/brand/AppLoader'
import type { ReactNode } from 'react'

export function RequireAgency({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  // Wait for the shared auth state to resolve before deciding anything.
  // Without this a freshly-signed-up user is bounced to /login on first render.
  if (loading) return <AppLoader />

  if (!profile) return <Navigate to="/login" replace />

  if (profile.role === 'client_user') {
    return <Navigate to="/portal" replace />
  }

  if (!isAgencyRole(profile.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
