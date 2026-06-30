import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/brand/AppLoader'
import type { ReactNode } from 'react'

export function RequireClient({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  // Wait for the shared auth state to resolve before deciding anything.
  if (loading) return <AppLoader />

  if (!profile) return <Navigate to="/login" replace />

  if (profile.role !== 'client_user') {
    return <Navigate to="/agency" replace />
  }

  return <>{children}</>
}
