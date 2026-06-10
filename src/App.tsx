import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { AppLoader } from '@/components/brand/AppLoader'

export default function App() {
  const [ready, setReady] = useState(false)

  if (!ready) {
    return <AppLoader variant="app" onComplete={() => setReady(true)} />
  }

  return <RouterProvider router={router} />
}
