import { Outlet } from 'react-router-dom'
import { ClientHeader } from '@/portals/client/layouts/ClientHeader'
import { ClientNav }    from '@/portals/client/layouts/ClientNav'

export function ClientLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
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
