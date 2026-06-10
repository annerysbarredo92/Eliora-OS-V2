import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { ReactNode } from 'react'

export function RequireClient({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  if (!profile) return <Navigate to="/login" replace />

  if (profile.role !== 'client_user') {
    return <Navigate to="/agency" replace />
  }

  return <>{children}</>
}
