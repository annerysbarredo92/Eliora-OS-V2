/**
 * Deterministic password-recovery intent marker.
 *
 * Why this exists: Supabase's GoTrue client auto-initializes at
 * construction time (module load) and, for a URL-detected session,
 * broadcasts PASSWORD_RECOVERY/SIGNED_IN via a `setTimeout(fn, 0)`
 * macrotask — i.e. within milliseconds of page load. This app's
 * AuthProvider doesn't mount (and doesn't subscribe via
 * onAuthStateChange) until App.tsx's startup splash clears, ~2.8s
 * later. The event fires into an empty room and is lost; by the time
 * AuthProvider's own getSession() bootstrap runs, all that's left is an
 * already-established, generically-authenticated session with no
 * recovery tag anywhere. Confirmed by reading node_modules/@supabase/
 * auth-js/src/GoTrueClient.ts directly — this is not timing-flaky, it
 * is deterministic, which is why every production attempt failed the
 * same way.
 *
 * This marker sidesteps the problem entirely: it does not depend on
 * catching any Supabase event, any URL parameter, or any flow type
 * (implicit or PKCE). ForgotPage sets it locally, in this browser's
 * localStorage, BEFORE the recovery email is even sent. AuthProvider
 * checks it synchronously at the very start of its own mount — for
 * ANY route, including a direct reload of /reset-password — and
 * establishes recovery mode from it alone.
 *
 * localStorage (not sessionStorage) so the marker survives the email
 * link opening in a different tab of the same browser. It carries a
 * timestamp only — no tokens, codes, or session data — and is not
 * itself authorization; Supabase still owns session/token validation.
 * It only tells the app which flow to expect.
 */

const STORAGE_KEY = 'eliora_auth_recovery_pending'
const TTL_MS = 45 * 60 * 1000 // 45 minutes — within the requested 30-60 min window

interface RecoveryMarker {
  ts: number
}

/** Call immediately before `supabase.auth.resetPasswordForEmail(...)`. */
export function markRecoveryPending(): void {
  try {
    const marker: RecoveryMarker = { ts: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marker))
  } catch {
    // localStorage unavailable (private browsing, disabled storage) —
    // recovery detection falls back to whatever Supabase event/URL
    // signal actually arrives (see AuthCallbackPage's type=recovery check).
  }
}

/**
 * True if a not-yet-expired recovery marker exists. Does not consume
 * it — callers that establish recovery mode from this should leave it
 * in place; only clearRecoveryPending() (called from completeRecovery())
 * removes it, so it survives a page refresh mid-recovery.
 */
export function hasRecoveryPending(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Partial<RecoveryMarker>
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Call once recovery is genuinely over: a successful password update,
 * or a definitive expiry/failure (an invalid/used callback). */
export function clearRecoveryPending(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
