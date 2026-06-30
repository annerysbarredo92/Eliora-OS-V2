import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Google OAuth sign-in. Coexists with email+password.
 *  Requires the Google provider enabled in Supabase Auth (see wave-03 README). */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    if (error) { setError(error.message); setBusy(false) }
    // on success the browser redirects to Google; AuthProvider resolves the session on return.
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button" onClick={go} disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, width: '100%',
          fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '14.5px', padding: '13px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface-solid)',
          color: 'var(--ink)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, transition: 'all .2s',
        }}
        onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.background = 'var(--lavender-soft)' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.background = 'var(--surface-solid)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z" /></svg>
        {label}
      </button>
      {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
