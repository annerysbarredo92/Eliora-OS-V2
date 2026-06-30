import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { ContentItem, ContentComment, ContentApproval, ContentStatus, ContentApprovalAction } from '@/types'

export interface ContentCtx {
  agencyId: string
  actorId: string
  role: 'agency' | 'client'
}

export interface ContentFormValues {
  client_id: string
  title: string
  content_type: ContentItem['content_type']
  platform: ContentItem['platform']
  campaign: string
  caption: string
  cta: string
  hashtags: string
  scheduled_date: string
  status: ContentStatus
  internal_notes: string
  client_notes: string
}

/* ── Agency reads (base table) ───────────────────────────── */
export async function listAgencyContent(clientId?: string): Promise<ContentItem[]> {
  let q = supabase.from('content_items').select('*').order('created_at', { ascending: false })
  if (clientId) q = q.eq('client_id', clientId)
  const { data, error } = await q
  if (error) { console.error('listAgencyContent:', error.message); throw new Error(error.message) }
  return (data ?? []) as ContentItem[]
}

export async function getAgencyContent(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabase.from('content_items').select('*').eq('id', id).maybeSingle()
  if (error) { console.error('getAgencyContent:', error.message); return null }
  return (data as ContentItem) ?? null
}

/* ── Client reads (security-definer view) ────────────────── */
export async function listClientContent(): Promise<ContentItem[]> {
  const { data, error } = await supabase.from('content_items_client').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listClientContent:', error.message); return [] }
  return (data ?? []) as ContentItem[]
}

/* ── Comments / approvals ────────────────────────────────── */
export async function listComments(contentId: string, includeInternal: boolean): Promise<ContentComment[]> {
  let q = supabase.from('content_comments').select('*').eq('content_id', contentId).order('created_at')
  if (!includeInternal) q = q.eq('is_internal', false)
  const { data, error } = await q
  if (error) { console.error('listComments:', error.message); return [] }
  return (data ?? []) as ContentComment[]
}

export async function listApprovals(contentId: string): Promise<ContentApproval[]> {
  const { data, error } = await supabase.from('content_approvals').select('*').eq('content_id', contentId).order('created_at', { ascending: false })
  if (error) { console.error('listApprovals:', error.message); return [] }
  return (data ?? []) as ContentApproval[]
}

/* ── Agency writes ───────────────────────────────────────── */
export async function createContent(v: ContentFormValues, ctx: ContentCtx): Promise<ContentItem> {
  const { data, error } = await supabase.from('content_items').insert({
    agency_id: ctx.agencyId, client_id: v.client_id, title: v.title.trim(),
    content_type: v.content_type, platform: v.platform, campaign: v.campaign.trim() || null,
    caption: v.caption.trim() || null, cta: v.cta.trim() || null, hashtags: v.hashtags.trim() || null,
    scheduled_date: v.scheduled_date || null, status: v.status,
    internal_notes: v.internal_notes.trim() || null, client_notes: v.client_notes.trim() || null,
    created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()
  if (error || !data) { console.error('createContent:', error?.message); throw new Error(error?.message ?? 'Could not create content') }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: v.client_id, action: 'content.created', entityType: 'content', entityId: data.id, description: `Created content: ${v.title.trim()}` })
  return data as ContentItem
}

export async function updateContent(id: string, v: ContentFormValues, ctx: ContentCtx): Promise<void> {
  const { error } = await supabase.from('content_items').update({
    title: v.title.trim(), content_type: v.content_type, platform: v.platform,
    campaign: v.campaign.trim() || null, caption: v.caption.trim() || null, cta: v.cta.trim() || null,
    hashtags: v.hashtags.trim() || null, scheduled_date: v.scheduled_date || null,
    internal_notes: v.internal_notes.trim() || null, client_notes: v.client_notes.trim() || null,
    updated_by: ctx.actorId,
  }).eq('id', id)
  if (error) { console.error('updateContent:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: v.client_id, action: 'content.updated', entityType: 'content', entityId: id, description: `Updated content: ${v.title.trim()}` })
}

export async function setContentStatus(c: ContentItem, to: ContentStatus, ctx: ContentCtx, reason?: string): Promise<void> {
  const { error } = await supabase.from('content_items').update({ status: to, updated_by: ctx.actorId }).eq('id', c.id)
  if (error) { console.error('setContentStatus:', error.message); throw new Error(error.message) }
  await supabase.from('content_approval_history').insert({
    agency_id: c.agency_id, client_id: c.client_id, content_id: c.id, from_status: c.status, to_status: to, actor_id: ctx.actorId, reason: reason ?? null,
  })
  const verb = to === 'client_review' ? 'content.submitted' : 'content.status_changed'
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: c.client_id, action: verb, entityType: 'content', entityId: c.id, description: to === 'client_review' ? `Submitted "${c.title}" for review` : `Moved "${c.title}" to ${to}` })
}

export async function deleteContent(c: ContentItem, ctx: ContentCtx): Promise<void> {
  const { error } = await supabase.from('content_items').delete().eq('id', c.id)
  if (error) { console.error('deleteContent:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: c.client_id, action: 'content.deleted', entityType: 'content', entityId: c.id, description: `Deleted content: ${c.title}` })
}

/* ── Comments (both roles) ───────────────────────────────── */
export async function addComment(c: ContentItem, body: string, ctx: ContentCtx, isInternal = false): Promise<void> {
  const { error } = await supabase.from('content_comments').insert({
    agency_id: c.agency_id, client_id: c.client_id, content_id: c.id,
    author_id: ctx.actorId, author_role: ctx.role, body: body.trim(), is_internal: ctx.role === 'client' ? false : isInternal,
  })
  if (error) { console.error('addComment:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: c.agency_id, actorId: ctx.actorId, clientId: c.client_id, action: 'content.comment_added', entityType: 'content', entityId: c.id, description: `Comment on "${c.title}"` })
}

/* ── Client decision (RPC; clients cannot write content_items directly) ──────── */
export async function clientDecision(c: ContentItem, action: ContentApprovalAction, note: string, ctx: ContentCtx): Promise<void> {
  const { error } = await supabase.rpc('client_content_decision', { _content_id: c.id, _action: action, _note: note || null })
  if (error) { console.error('clientDecision:', error.message); throw new Error(error.message) }
  const map: Record<ContentApprovalAction, string> = {
    approve: 'content.approved', request_changes: 'content.changes_requested', reject: 'content.rejected', comment: 'content.comment_added',
  }
  await logActivity({ agencyId: c.agency_id, actorId: ctx.actorId, clientId: c.client_id, action: map[action], entityType: 'content', entityId: c.id, description: `${map[action].split('.')[1].replace('_', ' ')}: "${c.title}"` })
}
