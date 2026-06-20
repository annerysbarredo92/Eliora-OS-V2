import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { PermissionSet, TeamMembership, TeamInvitation, UserProfile, UserRole } from '@/types'

interface Ctx { agencyId: string; actorId: string }

/* ── Permission sets ─────────────────────────────────────── */
export async function seedPresets(agencyId: string): Promise<void> {
  const { error } = await supabase.rpc('seed_permission_presets', { _agency_id: agencyId })
  if (error) console.error('seed_permission_presets:', error.message)
}
export async function listPermissionSets(): Promise<PermissionSet[]> {
  const { data, error } = await supabase.from('permission_sets').select('*').order('name')
  if (error) { console.error('listPermissionSets:', error.message); return [] }
  return (data ?? []) as PermissionSet[]
}
export async function createPermissionSet(name: string, permissions: Record<string, string[]>, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('permission_sets').insert({ agency_id: ctx.agencyId, name: name.trim(), permissions, created_by: ctx.actorId, updated_by: ctx.actorId })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'permission_set.created', entityType: 'permission_set', description: `Created permission set: ${name.trim()}` })
}
export async function updatePermissionSet(id: string, permissions: Record<string, string[]>, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('permission_sets').update({ permissions, updated_by: ctx.actorId }).eq('id', id)
  if (error) throw new Error(error.message)
}

/* ── Team directory (profiles + memberships) ─────────────── */
export interface TeamMember { profile: UserProfile; membership: TeamMembership | null }

export async function listTeam(agencyId: string): Promise<TeamMember[]> {
  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('*').eq('agency_id', agencyId).neq('role', 'client_user'),
    supabase.from('team_memberships').select('*'),
  ])
  const mMap = new Map((memberships ?? []).map(m => [m.profile_id, m as TeamMembership]))
  return (profiles ?? []).map(p => ({ profile: p as UserProfile, membership: mMap.get(p.id) ?? null }))
}

export async function upsertMembership(profileId: string, patch: Partial<TeamMembership>, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('team_memberships').upsert(
    { agency_id: ctx.agencyId, profile_id: profileId, ...patch, updated_by: ctx.actorId },
    { onConflict: 'agency_id,profile_id' },
  )
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'team.member_updated', entityType: 'team_member', entityId: profileId, description: 'Updated team member' })
}

export async function setMemberStatus(profileId: string, status: TeamMembership['status'], ctx: Ctx): Promise<void> {
  await upsertMembership(profileId, { status }, ctx)
}

/* ── Invitations (no email send; architecture ready) ─────── */
export async function listInvitations(): Promise<TeamInvitation[]> {
  const { data, error } = await supabase.from('team_invitations').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listInvitations:', error.message); return [] }
  return (data ?? []) as TeamInvitation[]
}
export async function createInvitation(email: string, role: UserRole, title: string, permissionSetId: string | null, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('team_invitations').insert({
    agency_id: ctx.agencyId, email: email.trim(), role, title: title.trim() || null, permission_set_id: permissionSetId,
    invited_by: ctx.actorId, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'team.invited', entityType: 'team_invitation', description: `Invited ${email.trim()}` })
}
export async function setInviteStatus(id: string, status: TeamInvitation['status']): Promise<void> {
  const { error } = await supabase.from('team_invitations').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

/* ── Client assignments (reuse team_assignments) ─────────── */
export async function assignClient(profileId: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('team_assignments').insert({ agency_id: ctx.agencyId, client_id: clientId, profile_id: profileId, created_by: ctx.actorId })
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId, action: 'team.assigned_client', entityType: 'team_assignment', description: 'Assigned client to team member' })
}
export async function unassignClient(profileId: string, clientId: string): Promise<void> {
  const { error } = await supabase.from('team_assignments').delete().eq('profile_id', profileId).eq('client_id', clientId)
  if (error) throw new Error(error.message)
}
export async function listAssignmentsFor(profileId: string): Promise<string[]> {
  const { data, error } = await supabase.from('team_assignments').select('client_id').eq('profile_id', profileId)
  if (error) return []
  return (data ?? []).map(r => r.client_id as string)
}
