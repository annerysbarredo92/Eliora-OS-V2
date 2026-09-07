import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ClientHeader } from '@/portals/client/layouts/ClientHeader'
import { ClientNav }    from '@/portals/client/layouts/ClientNav'
import { logLifecycle } from '@/lib/lifecycleDebug' // TEMPORARY — see lifecycleDebug.ts

export function ClientLayout() {
  // TEMPORARY — P1 tab-refocus investigation.
  const location = useLocation()
  useEffect(() => {
    logLifecycle('ClientLayout MOUNT', { pathname: location.pathname })
    return () => logLifecycle('ClientLayout UNMOUNT')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { logLifecycle('ClientLayout route change', { pathname: location.pathname }) }, [location.pathname])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <ClientHeader />
      <ClientNav />
      <main
        style={{
          flex: 1,
          padding: 'var(--space-8) var(--space-10)',
          maxWidth: 'var(--portal-content-max)',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
