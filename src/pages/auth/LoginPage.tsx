import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { fetchProfile, getPortalType } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GoogleButton } from '@/components/auth/GoogleButton'

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

    const profile = await fetchProfile(data.user.id, 2)
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
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 8 }}>
        Welcome back
      </h1>
      <p style={{ fontSize: 15.5, color: 'var(--ink-2)', marginBottom: 28 }}>
        Sign in to your Eliora OS.M workspace.
      </p>

      <div style={{ marginBottom: 16 }}><GoogleButton /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0 18px', color: 'var(--muted)', fontSize: '12.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />or<span style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <Input
          label="Work email"
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
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Link to="/forgot" style={{ fontSize: '12.5px', color: 'var(--violet)', textDecoration: 'none', fontWeight: 600 }}>
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth style={{ marginTop: 4 }}>
          Sign in
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </Button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: '14.5px', color: 'var(--ink-2)' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--violet)', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
      </p>
    </div>
  )
}
