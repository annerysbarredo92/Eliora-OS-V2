// All auth state now lives in a single AuthProvider mounted at the app root.
// This re-export keeps existing `import { useAuth } from '@/hooks/useAuth'`
// call sites working while ensuring every one reads the SAME shared state.
export { useAuth } from '@/app/AuthProvider'
export type { AuthState } from '@/app/AuthProvider'
