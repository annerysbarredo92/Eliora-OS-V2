import { Outlet } from 'react-router-dom'
import { AgencySidebar } from '@/portals/agency/layouts/AgencySidebar'
import { AgencyHeader }  from '@/portals/agency/layouts/AgencyHeader'

export function AgencyLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-2)' }}>
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
