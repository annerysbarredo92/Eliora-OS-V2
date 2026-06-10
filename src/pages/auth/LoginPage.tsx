import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { fetchProfile, getPortalType } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = (location.state as { from?: Location })?.from?.pathname

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError(authError?.message || 'Sign in failed. Please try again.')
      setLoading(false)
      return
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      setError('Account not found. Please contact your administrator.')
      setLoading(false)
      return
    }

    const portalType = getPortalType(profile.role)
    const dest = from || (portalType === 'client' ? '/portal' : '/agency')
    navigate(dest, { replace: true })
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 400,
            color: 'var(--ink)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Welcome back
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Sign in to your Eliora OS workspace.
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

        <div>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <div style={{ marginTop: 'var(--space-1)', textAlign: 'right' }}>
            <Link
              to="/forgot"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--brand-400)',
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--danger)',
              background: 'var(--danger-bg)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(220,38,38,0.15)',
            }}
          >
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
          Sign in
        </Button>
      </form>

      <p
        style={{
          marginTop: 'var(--space-6)',
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          color: 'var(--ink-4)',
        }}
      >
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--brand-500)', textDecoration: 'none', fontWeight: 500 }}>
          Sign up
        </Link>
      </p>
    </div>
  )
}
