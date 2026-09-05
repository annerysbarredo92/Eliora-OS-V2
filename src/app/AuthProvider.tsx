import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfile } from '@/lib/auth'
import { hasRecoveryPending, clearRecoveryPending } from '@/lib/recoveryIntent'
import type { UserProfile } from '@/types'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  profile: UserProfile | null
  loading: boolean
  error: string | null
  /**
   * True while the current Supabase session must be treated as a password
   * recovery in progress rather than a completed sign-in — the user has to
   * set a new password (see /reset-password) before any protected route
   * lets them through. Guards (RequireAuth) check this BEFORE `profile`,
   * so a stale profile from an earlier normal session can never leak
   * through during recovery.
   *
   * Established primarily from the durable localStorage marker (see
   * recoveryIntent.ts) set by ForgotPage BEFORE the recovery email is even
   * sent — checked synchronously on the very first render below, so it
   * does not depend on catching any particular Supabase auth event.
   *
   * This is deliberate: this client uses the implicit auth flow (default,
   * see src/lib/supabase.ts), and Supabase's GoTrue client auto-initializes
   * at construction (module load), broadcasting PASSWORD_RECOVERY/SIGNED_IN
   * for a URL-detected session via a same-tick `setTimeout(fn, 0)` — long
   * before this provider mounts and subscribes, since App.tsx holds a
   * ~2.8s startup splash first. That event is reliably lost; the marker
   * is what actually works. The PASSWORD_RECOVERY event handling below is
   * kept only as a secondary signal (e.g. the email link opened on a
   * different device than the one that requested it, where the marker
   * can't exist).
   */
  recovery: boolean
}

export interface AuthContextValue extends AuthState {
  /**
   * Call after `supabase.auth.updateUser({ password })` succeeds, to leave
   * recovery mode and resolve the real profile. Clears the recovery marker
   * first. Returns the resolved profile (or null) directly — the context
   * update lands on the next render, but the caller (ResetPasswordPage)
   * needs the value immediately to decide which portal to route into.
   */
  completeRecovery: () => Promise<UserProfile | null>
  /**
   * Secondary/fallback signal only — see the `recovery` doc comment above.
   * Call if AuthCallbackPage detects `type=recovery` directly in the
   * callback URL and no marker was found (e.g. cross-device). Kept for
   * defense in depth; the marker checked on mount below is what actually
   * carries this in the normal same-browser case.
   */
  beginRecovery: () => void
}

function computeInitialState(): AuthState {
  // Checked synchronously on the component's first render — before any
  // effect, any Supabase call, or any event has a chance to run. This is
  // what makes recovery mode survive a hard refresh of /reset-password,
  // and what makes it correct the instant /auth/callback mounts, no
  // matter how long the app's own startup sequence takes.
  return { profile: null, loading: true, error: null, recovery: hasRecoveryPending() }
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  error: null,
  recovery: false,
  completeRecovery: async () => null,
  beginRecovery: () => {},
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
 * Recovery mode: see the `recovery` field doc comment above — established
 * from a durable localStorage marker, not from Supabase event timing.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(computeInitialState)

  useEffect(() => {
    let mounted = true

    async function loadFromSession(session: Session | null) {
      if (!session?.user) {
        // This branch only runs from the initial bootstrap getSession()
        // call below — the event-handler call site further down never
        // invokes loadFromSession with a null session, it pre-filters that
        // itself. The app's own startup splash (App.tsx) can delay this
        // bootstrap call by several seconds, well after computeInitialState
        // already set `recovery: true` from the marker (or after
        // beginRecovery()/PASSWORD_RECOVERY set it). Hardcoding
        // `recovery: false` here would silently clobber that. Preserve
        // whatever it already is — a genuine sign-out is handled
        // separately below (SIGNED_OUT via onAuthStateChange), which does
        // hard-clear it (and the durable marker).
        if (mounted) setState(s => ({ ...s, profile: null, loading: false, error: null }))
        return
      }
      // Retries cover the brief window after signup where the trigger-created
      // profile row may not yet be visible to this read.
      const profile = await fetchProfile(session.user.id, 3)
      if (mounted) {
        // Deliberately do NOT touch `recovery` here. This runs for every
        // SIGNED_IN event, including the one Supabase's PKCE code exchange
        // fires for a password-recovery link (it does not reliably emit
        // PASSWORD_RECOVERY instead). Resolving a profile — even a real,
        // valid one — must never by itself flip a recovery session into a
        // normal one; only completeRecovery() (called after a successful
        // updateUser({ password })) or an explicit sign-out may do that.
        setState(s => ({ ...s, profile, loading: false, error: profile ? null : 'Profile not found' }))
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
        // Genuine SIGNED_OUT (or equivalent) — a deliberate, unambiguous
        // end of any session, including a recovery one. Clear both the
        // in-memory flag and the durable marker together.
        clearRecoveryPending()
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
    // Clear the durable marker first — recovery is genuinely over from
    // here, whether or not a session/profile actually resolves below.
    clearRecoveryPending()
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      setState({ profile: null, loading: false, error: null, recovery: false })
      return null
    }
    const profile = await fetchProfile(data.session.user.id, 2)
    setState({ profile, loading: false, error: profile ? null : 'Profile not found', recovery: false })
    return profile
  }, [])

  // Synchronous by design — see the AuthContextValue doc comment. Must be
  // callable before any async exchange/profile work even starts.
  const beginRecovery = useCallback(() => {
    setState(s => ({ ...s, recovery: true, loading: false }))
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, completeRecovery, beginRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Read the shared auth state. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
