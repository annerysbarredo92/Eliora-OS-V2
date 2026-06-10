import { supabase } from './supabase'
import type { UserProfile, UserRole, PortalType } from '@/types'

/* ── Role helpers ───────────────────────────────────────── */
const AGENCY_ROLES = new Set<UserRole>([
  'master_admin', 'agency_owner', 'admin',
  'content_manager', 'strategist', 'editor',
  'client_success', 'contractor', 'team_member',
])

const ADMIN_ROLES = new Set<UserRole>([
  'master_admin', 'agency_owner', 'admin',
])

export function getPortalType(role: UserRole): PortalType {
  if (role === 'client_user') return 'client'
  if (AGENCY_ROLES.has(role)) return 'agency'
  return 'public'
}

export function isAgencyRole(role: UserRole): boolean {
  return AGENCY_ROLES.has(role)
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.has(role)
}

export function canAccess(profile: UserProfile, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(profile.role)
}

/* ── Profile fetch ──────────────────────────────────────── */
export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as UserProfile
}

/* ── Sign out ───────────────────────────────────────────── */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
