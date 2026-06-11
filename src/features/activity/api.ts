import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types'

export interface LogActivityInput {
  agencyId: string
  actorId: string
  action: string
  entityType: string
  entityId?: string | null
  clientId?: string | null
  description?: string
  metadata?: Record<string, unknown>
}

/**
 * Append an activity row. Best-effort: a logging failure must never block the
 * primary mutation, so we swallow the error after reporting it.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    agency_id:        input.agencyId,
    actor_profile_id: input.actorId,
    action:           input.action,
    entity_type:      input.entityType,
    entity_id:        input.entityId ?? null,
    client_id:        input.clientId ?? null,
    description:      input.description ?? null,
    metadata:         input.metadata ?? {},
  })
  if (error) console.error('logActivity failed:', error.message)
}

export interface ListActivityParams {
  clientId?: string
  limit?: number
}

/** Most-recent-first activity, optionally scoped to one client. RLS scopes to agency. */
export async function listActivity({ clientId, limit = 20 }: ListActivityParams = {}): Promise<ActivityLog[]> {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) {
    console.error('listActivity failed:', error.message)
    return []
  }
  return (data ?? []) as ActivityLog[]
}
