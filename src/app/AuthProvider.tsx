import { createContext, useContext } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { UserProfile } from '@/types'
import type { ReactNode } from 'react'

interface AuthCtx {
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthCtx>({ profile: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthCtx {
  return useContext(AuthContext)
}
