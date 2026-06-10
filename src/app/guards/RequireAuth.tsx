import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/brand/AppLoader'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AppLoader variant="app" />

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
