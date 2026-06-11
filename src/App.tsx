import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { AuthProvider } from '@/app/AuthProvider'
import { AppLoader } from '@/components/brand/AppLoader'

export default function App() {
  const [ready, setReady] = useState(false)

  if (!ready) {
    return <AppLoader onComplete={() => setReady(true)} />
  }

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
