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
// `.maybeSingle()` returns { data: null } for 0 rows instead of throwing,
// so a missing profile is distinguishable from a real query error.
// `retries` covers the brief window right after signup where the row was just
// created by the auth trigger and may not yet be visible to this read.
export async function fetchProfile(userId: string, retries = 0): Promise<UserProfile | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) return data as UserProfile

    // A real error (e.g. RLS) is logged so it is not silently swallowed.
    if (error) console.error('fetchProfile error:', error.message)

    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 350))
    }
  }
  return null
}

/* ── Sign out ───────────────────────────────────────────── */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
