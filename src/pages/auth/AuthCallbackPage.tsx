import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getPortalType } from '@/lib/auth'
import { InfinityMark } from '@/components/brand/InfinityMark'

type Phase = 'working' | 'error'

/**
 * Single landing point for every Supabase auth redirect: password recovery
 * (ForgotPage.tsx), magic links, and OAuth (GoogleButton.tsx) all send the
 * browser back here with either a PKCE `?code=` param or, for the older
 * implicit flow, an `#access_token=...&type=...` hash.
 *
 * Responsibility split:
 *  - THIS page: detect what Supabase put in the URL and establish/exchange
 *    the session. It never reads or writes profile/agency data itself.
 *  - AuthProvider: owns the resulting session/profile/recovery state (see
 *    the PASSWORD_RECOVERY handling there) — this page only *observes* that
 *    state to decide where to route once it has settled.
 *
 * Not wrapped by RequireAuth/RequireAgency/RequireClient (see router.tsx) —
 * it must be reachable with no session at all, and it does its own routing
 * once one exists.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { profile, loading, recovery } = useAuth()
  const [phase, setPhase] = useState<Phase>('working')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function fail(message: string) {
    setErrorMessage(message)
    setPhase('error')
  }

  // Step 1 — establish the session from whatever Supabase put in the URL.
  useEffect(() => {
    let cancelled = false

    async function run() {
      const url = new URL(window.location.href)
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))

      // Supabase appends this on a failed/expired link instead of a code.
      const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description')
      if (errorDescription) {
        if (!cancelled) fail(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
        return
      }

      const code = url.searchParams.get('code')
      if (code) {
        // PKCE / code-exchange flow — the flow this Supabase JS version uses
        // for password-recovery and magic-link redirects. Exchanging here
        // (rather than relying only on detectSessionInUrl) is the documented
        // pattern for a dedicated SPA callback route.
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (cancelled) return
        if (error) fail(error.message)
        // On success, say nothing here — AuthProvider's onAuthStateChange
        // fires SIGNED_IN or PASSWORD_RECOVERY off this same exchange, and
        // step 2 below reacts to that.
        return
      }

      // No `code` present — either an implicit-flow hash, which
      // detectSessionInUrl:true already parsed automatically when the
      // Supabase client initialized, or a stale/malformed link. Give
      // AuthProvider a brief moment to observe that, then check.
      await new Promise(resolve => setTimeout(resolve, 400))
      if (cancelled) return
      const { data } = await supabase.auth.getSession()
      if (!data.session) fail('This link is invalid or has expired.')
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step 2 — once AuthProvider has settled, route to the right place.
  useEffect(() => {
    if (phase === 'error') return
    if (loading) return

    if (recovery) {
      navigate('/reset-password', { replace: true })
      return
    }

    if (profile) {
      navigate(getPortalType(profile.role) === 'client' ? '/portal' : '/agency', { replace: true })
      return
    }

    // Loading settled, not in recovery, and no profile resolved — the
    // exchange above didn't produce a usable session (used/expired link).
    fail('We could not verify your sign-in link. Please try again.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, loading, recovery, profile, navigate])

  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Link expired</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>{errorMessage}</p>
        <Link to="/forgot" style={{ fontSize: 13.5, color: 'var(--violet)', fontWeight: 600, textDecoration: 'none' }}>
          Request a new link →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
      <InfinityMark size={40} draw />
      <p style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 500 }}>Securing your session…</p>
    </div>
  )
}
