import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfile } from '@/lib/auth'
import type { UserProfile } from '@/types'

interface AuthState {
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    profile: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        if (mounted) setState({ profile: null, loading: false, error: null })
        return
      }

      const profile = await fetchProfile(session.user.id, 3)
      if (mounted) {
        setState({ profile, loading: false, error: profile ? null : 'Profile not found' })
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          if (mounted) setState({ profile: null, loading: false, error: null })
          return
        }
        const profile = await fetchProfile(session.user.id, 3)
        if (mounted) {
          setState({ profile, loading: false, error: null })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
