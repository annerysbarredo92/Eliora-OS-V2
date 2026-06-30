import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfile } from '@/lib/auth'
import type { UserProfile } from '@/types'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

const AuthContext = createContext<AuthState>({ profile: null, loading: true, error: null })

/**
 * Single source of truth for auth. Mounted once at the app root so every
 * guard and component reads the SAME session + profile state.
 *
 * Previously each component called useAuth() independently, which created
 * separate state machines — a child guard could see profile=null (its own
 * fetch hadn't resolved yet) and redirect to /login even though the user was
 * authenticated. Centralizing here fixes that class of routing bug.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ profile: null, loading: true, error: null })

  useEffect(() => {
    let mounted = true

    async function loadFromSession(session: Session | null) {
      if (!session?.user) {
        if (mounted) setState({ profile: null, loading: false, error: null })
        return
      }
      // Retries cover the brief window after signup where the trigger-created
      // profile row may not yet be visible to this read.
      const profile = await fetchProfile(session.user.id, 3)
      if (mounted) {
        setState({ profile, loading: false, error: profile ? null : 'Profile not found' })
      }
    }

    // Initial bootstrap.
    supabase.auth.getSession().then(({ data }) => loadFromSession(data.session))

    // React to later auth changes (login, signup, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return            // handled by getSession() above
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return // keep current profile

      if (!session?.user) {
        if (mounted) setState({ profile: null, loading: false, error: null })
        return
      }

      // SIGNED_IN: re-enter loading so guards wait instead of acting on a stale null.
      if (mounted) setState(s => ({ ...s, loading: true }))
      loadFromSession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

/** Read the shared auth state. */
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
