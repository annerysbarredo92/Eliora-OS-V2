import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { ClientRequest, RequestType, RequestStatus, RequestComment } from '@/types'

interface Ctx { agencyId: string; clientId: string; actorId: string; role: 'agency' | 'client' }

export const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: 'content', label: 'Content Request' },
  { value: 'file', label: 'File Request' },
  { value: 'campaign', label: 'Campaign Request' },
  { value: 'strategy', label: 'Strategy Question' },
  { value: 'support', label: 'Support Request' },
  { value: 'meeting', label: 'Meeting Request' },
]
export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; badge: 'default' | 'info' | 'warning' | 'success' | 'brand' }> = {
  submitted:   { label: 'Submitted', badge: 'brand' },
  in_review:   { label: 'In Review', badge: 'info' },
  in_progress: { label: 'In Progress', badge: 'info' },
  waiting:     { label: 'Waiting', badge: 'warning' },
  completed:   { label: 'Completed', badge: 'success' },
  closed:      { label: 'Closed', badge: 'default' },
}

export async function listRequests(clientId?: string): Promise<ClientRequest[]> {
  let q = supabase.from('client_requests').select('*').order('created_at', { ascending: false })
  if (clientId) q = q.eq('client_id', clientId)
  const { data, error } = await q
  if (error) { console.error('listRequests:', error.message); return [] }
  return (data ?? []) as ClientRequest[]
}
export async function createRequest(type: RequestType, title: string, description: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('client_requests').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId, type, title: title.trim(), description: description.trim() || null, created_by: ctx.actorId,
  })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'request.submitted', entityType: 'client_request', description: `Request: ${title.trim()}` })
}
export async function setRequestStatus(r: ClientRequest, status: RequestStatus, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('client_requests').update({ status }).eq('id', r.id)
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: r.client_id, action: 'request.status_changed', entityType: 'client_request', entityId: r.id, description: `Request "${r.title}" → ${status}` })
}
export async function assignRequest(r: ClientRequest, assigneeId: string | null): Promise<void> {
  const { error } = await supabase.from('client_requests').update({ assignee_id: assigneeId }).eq('id', r.id)
  if (error) throw new Error(error.message)
}
export async function listRequestComments(requestId: string): Promise<RequestComment[]> {
  const { data } = await supabase.from('request_comments').select('*').eq('request_id', requestId).order('created_at')
  return (data ?? []) as RequestComment[]
}
export async function addRequestComment(r: ClientRequest, body: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('request_comments').insert({ agency_id: ctx.agencyId, client_id: ctx.clientId, request_id: r.id, author_id: ctx.actorId, author_role: ctx.role, body: body.trim() })
  if (error) throw new Error(error.message)
}
