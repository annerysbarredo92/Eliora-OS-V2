import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfile } from '@/lib/auth'
import type { UserProfile } from '@/types'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  profile: UserProfile | null
  loading: boolean
  error: string | null
  /**
   * True while the current Supabase session exists ONLY because the user
   * followed a password-recovery link (auth event `PASSWORD_RECOVERY`).
   * A recovery session is authenticated at the Supabase level but must not
   * be treated as a normal sign-in — the user has to set a new password
   * (see /reset-password) before any protected route lets them through.
   * Guards (RequireAuth) check this BEFORE `profile`, so a stale profile
   * from an earlier normal session can never leak through during recovery.
   */
  recovery: boolean
}

export interface AuthContextValue extends AuthState {
  /**
   * Call after `supabase.auth.updateUser({ password })` succeeds, to leave
   * recovery mode and resolve the real profile. Returns the resolved
   * profile (or null) directly — the context update lands on the next
   * render, but the caller (ResetPasswordPage) needs the value immediately
   * to decide which portal to route into.
   */
  completeRecovery: () => Promise<UserProfile | null>
}

const initialState: AuthState = { profile: null, loading: true, error: null, recovery: false }

const AuthContext = createContext<AuthContextValue>({
  ...initialState,
  completeRecovery: async () => null,
})

/**
 * Single source of truth for auth. Mounted once at the app root so every
 * guard and component reads the SAME session + profile state.
 *
 * Previously each component called useAuth() independently, which created
 * separate state machines — a child guard could see profile=null (its own
 * fetch hadn't resolved yet) and redirect to /login even though the user was
 * authenticated. Centralizing here fixes that class of routing bug.
 *
 * Recovery mode: a password-recovery link (from ForgotPage.tsx, handled by
 * AuthCallbackPage.tsx) makes Supabase emit a `PASSWORD_RECOVERY` event with
 * a real session attached. That session must not be treated as a completed
 * login — see the `recovery` flag above and RequireAuth.tsx.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let mounted = true

    async function loadFromSession(session: Session | null) {
      if (!session?.user) {
        if (mounted) setState({ profile: null, loading: false, error: null, recovery: false })
        return
      }
      // Retries cover the brief window after signup where the trigger-created
      // profile row may not yet be visible to this read.
      const profile = await fetchProfile(session.user.id, 3)
      if (mounted) {
        setState({ profile, loading: false, error: profile ? null : 'Profile not found', recovery: false })
      }
    }

    // Initial bootstrap.
    supabase.auth.getSession().then(({ data }) => loadFromSession(data.session))

    // React to later auth changes (login, signup, logout, recovery).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return            // handled by getSession() above
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return // keep current profile/recovery as-is

      if (event === 'PASSWORD_RECOVERY') {
        // A recovery-flow session just landed (see AuthCallbackPage.tsx).
        // Flag recovery mode and stop — do NOT fetch a profile or let this
        // read as a normal sign-in. RequireAuth redirects to /reset-password
        // whenever this flag is set, regardless of what profile/route was
        // requested. ResetPasswordPage clears it via completeRecovery().
        if (mounted) setState(s => ({ ...s, loading: false, recovery: true }))
        return
      }

      if (!session?.user) {
        if (mounted) setState({ profile: null, loading: false, error: null, recovery: false })
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

  const completeRecovery = useCallback(async (): Promise<UserProfile | null> => {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      setState({ profile: null, loading: false, error: null, recovery: false })
      return null
    }
    const profile = await fetchProfile(data.session.user.id, 2)
    setState({ profile, loading: false, error: profile ? null : 'Profile not found', recovery: false })
    return profile
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, completeRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Read the shared auth state. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
