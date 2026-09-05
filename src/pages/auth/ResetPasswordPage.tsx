import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getPortalType } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const MIN_LENGTH = 8

/**
 * Reached only after AuthCallbackPage routes here on a `PASSWORD_RECOVERY`
 * event (see AuthProvider.tsx `recovery` flag). Not wrapped by RequireAuth —
 * a recovery session is intentionally NOT a normal authenticated session,
 * so the ordinary "must be logged in" guard does not apply here.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { recovery, loading, completeRecovery } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setBusy(false)
      return
    }

    // Leaves recovery mode and resolves the real profile in one step.
    const profile = await completeRecovery()
    setBusy(false)
    setSuccess(true)

    setTimeout(() => {
      const dest = profile ? (getPortalType(profile.role) === 'client' ? '/portal' : '/agency') : '/login'
      navigate(dest, { replace: true })
    }, 1400)
  }

  if (loading) {
    return <p style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>Loading…</p>
  }

  // No active recovery session and we didn't just finish one ourselves —
  // either a stale bookmark, a reused link, or the session expired.
  if (!recovery && !success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Recovery link expired</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>
          This password reset link is no longer valid. Request a new one to continue.
        </p>
        <Link to="/forgot" style={{ fontSize: 13.5, color: 'var(--violet)', fontWeight: 600, textDecoration: 'none' }}>
          Request a new link →
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>✅</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Password updated</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Taking you to your workspace…</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 8 }}>
        Set a new password
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 24 }}>
        Choose a new password for your Eliora OS account.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          hint={`At least ${MIN_LENGTH} characters`}
          required
          autoFocus
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={busy} fullWidth style={{ marginTop: 4 }}>
          Save password
        </Button>
      </form>
    </div>
  )
}
