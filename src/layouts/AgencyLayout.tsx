import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AgencySidebar } from '@/portals/agency/layouts/AgencySidebar'
import { AgencyHeader }  from '@/portals/agency/layouts/AgencyHeader'
import { logLifecycle } from '@/lib/lifecycleDebug' // TEMPORARY — see lifecycleDebug.ts

export function AgencyLayout() {
  // TEMPORARY — P1 tab-refocus investigation.
  const location = useLocation()
  useEffect(() => {
    logLifecycle('AgencyLayout MOUNT', { pathname: location.pathname })
    return () => logLifecycle('AgencyLayout UNMOUNT')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { logLifecycle('AgencyLayout route change', { pathname: location.pathname }) }, [location.pathname])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <AgencySidebar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: 'var(--sidebar-width)',
        }}
      >
        <AgencyHeader />
        <main
          style={{
            flex: 1,
            padding: 'var(--space-8)',
            paddingTop: 'calc(var(--header-height) + var(--space-8))',
            maxWidth: 'var(--content-max)',
            width: '100%',
            margin: '0 auto',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
