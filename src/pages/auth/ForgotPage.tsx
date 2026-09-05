import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { markRecoveryPending } from '@/lib/recoveryIntent'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ForgotPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Mark recovery-intent BEFORE sending the email, not after any Supabase
    // event arrives — see recoveryIntent.ts. Deliberately independent of
    // whatever event/URL shape the actual callback produces.
    markRecoveryPending()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="animate-fade-up" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }}>✉️</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', fontWeight: 400, marginBottom: 'var(--space-2)' }}>
          Check your email
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', marginBottom: 'var(--space-6)' }}>
          We sent a password reset link to <strong>{email}</strong>
        </p>
        <Link to="/login" style={{ color: 'var(--brand-500)', textDecoration: 'none', fontSize: 'var(--text-sm)' }}>
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-2xl)', fontWeight: 400, color: 'var(--ink)', marginBottom: 'var(--space-2)' }}>
          Reset password
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@agency.com"
          required
          autoFocus
        />

        {error && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius)' }}>
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
          Send reset link
        </Button>
      </form>

      <p style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
        <Link to="/login" style={{ color: 'var(--brand-500)', textDecoration: 'none' }}>← Back to sign in</Link>
      </p>
    </div>
  )
}
