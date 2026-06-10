import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isAgencyRole } from '@/lib/auth'
import type { ReactNode } from 'react'

export function RequireAgency({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  if (!profile) return <Navigate to="/login" replace />

  if (profile.role === 'client_user') {
    return <Navigate to="/portal" replace />
  }

  if (!isAgencyRole(profile.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
