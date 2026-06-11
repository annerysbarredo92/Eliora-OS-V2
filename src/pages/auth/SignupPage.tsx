import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { fetchProfile } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function SignupPage() {
  const navigate = useNavigate()

  const [agencyName, setAgencyName] = useState('')
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [notice,     setNotice]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          agency_name:  agencyName,
          role:         'agency_owner',
        },
      },
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    // No session means email confirmation is still ON in Supabase.
    // Don't bounce the user into the app (which would redirect to login).
    if (!data.session || !data.user) {
      setNotice('Account created. Check your email to confirm, then sign in.')
      setLoading(false)
      return
    }

    // Confirm the auth trigger created the agency + profile before entering
    // the app. Retries cover the brief commit/visibility window.
    const profile = await fetchProfile(data.user.id, 5)
    if (!profile) {
      setError(
        'Your account was created but the workspace could not be loaded. ' +
        'Please try signing in.'
      )
      setLoading(false)
      return
    }

    navigate('/agency', { replace: true })
  }

  return (
    <div className="animate-fade-up">
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 8 }}>
        Create your workspace
      </h1>
      <p style={{ fontSize: 15.5, color: 'var(--ink-2)', marginBottom: 28 }}>
        Start your 14-day free trial. No credit card required.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <Input
          label="Agency name"
          type="text"
          value={agencyName}
          onChange={e => setAgencyName(e.target.value)}
          placeholder="Northlight Studio"
          required
          autoFocus
        />
        <Input
          label="Your name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Jane Smith"
          required
        />
        <Input
          label="Work email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@youragency.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          hint="Use 8+ characters with a mix of letters and numbers."
          required
          minLength={8}
        />

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{ fontSize: '13px', color: 'var(--violet)', background: 'var(--lavender-soft)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--hairline)' }}>
            {notice}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth style={{ marginTop: 4 }}>
          Create workspace
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </Button>

        <p style={{ fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
          By creating a workspace you agree to Eliora's{' '}
          <Link to="#" style={{ color: 'var(--ink-2)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms</Link>
          {' '}and{' '}
          <Link to="#" style={{ color: 'var(--ink-2)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</Link>.
        </p>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: '14.5px', color: 'var(--ink-2)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--violet)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
      </p>
    </div>
  )
}
