import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signupError } = await supabase.auth.signUp({
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

    navigate('/agency', { replace: true })
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
          Create your workspace
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Get started with Eliora OS free for 14 days.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          label="Agency name"
          type="text"
          value={agencyName}
          onChange={e => setAgencyName(e.target.value)}
          placeholder="Your Agency Name"
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
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@agency.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          hint="At least 8 characters."
          required
          minLength={8}
        />

        {error && (
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--danger)',
              background: 'var(--danger-bg)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius)',
            }}
          >
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
          Create workspace
        </Button>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-5)', textAlign: 'center' }}>
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>

      <p
        style={{
          marginTop: 'var(--space-6)',
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          color: 'var(--ink-4)',
        }}
      >
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--brand-500)', textDecoration: 'none', fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
