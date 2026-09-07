import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/global.css'
import App from './App'
import { logLifecycle } from '@/lib/lifecycleDebug'

// TEMPORARY — P1 tab-refocus investigation. Registered at the document
// level, before React ever mounts, so this timeline is independent of
// any component remount being investigated. Filter DevTools Console by
// "[ELIORA-LIFECYCLE]". Remove once the root cause is confirmed.
logLifecycle('main.tsx module evaluated')
document.addEventListener('visibilitychange', () => {
  logLifecycle('document visibilitychange', { visibilityState: document.visibilityState })
})
window.addEventListener('focus', () => logLifecycle('window focus'))
window.addEventListener('blur', () => logLifecycle('window blur'))
window.addEventListener('pageshow', (e) => logLifecycle('window pageshow', { persisted: e.persisted }))
window.addEventListener('pagehide', (e) => logLifecycle('window pagehide', { persisted: e.persisted }))
window.addEventListener('online', () => logLifecycle('window online'))
window.addEventListener('offline', () => logLifecycle('window offline'))
window.addEventListener('beforeunload', () => logLifecycle('window beforeunload'))

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
