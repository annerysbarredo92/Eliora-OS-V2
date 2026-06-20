import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { PipelineStage, Lead, LeadNote, LeadActivity } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export async function seedStages(agencyId: string): Promise<void> {
  const { error } = await supabase.rpc('seed_pipeline_stages', { _agency_id: agencyId })
  if (error) console.error('seed_pipeline_stages:', error.message)
}
export async function listStages(): Promise<PipelineStage[]> {
  const { data, error } = await supabase.from('pipeline_stages').select('*').order('sort_order')
  if (error) { console.error('listStages:', error.message); return [] }
  return (data ?? []) as PipelineStage[]
}
export async function updateStage(id: string, patch: Partial<PipelineStage>): Promise<void> {
  const { error } = await supabase.from('pipeline_stages').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
export async function createStage(name: string, ctx: Ctx): Promise<void> {
  const { count } = await supabase.from('pipeline_stages').select('id', { count: 'exact', head: true })
  const { error } = await supabase.from('pipeline_stages').insert({ agency_id: ctx.agencyId, name: name.trim(), sort_order: (count ?? 0) + 1, probability: 50 })
  if (error) throw new Error(error.message)
}

export interface LeadFormValues {
  business_name: string; name: string; email: string; phone: string; website: string
  source: string; stage_id: string; estimated_value_cents: number; owner_id: string; notes: string
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from('leads').select('*').neq('status', 'archived').order('created_at', { ascending: false })
  if (error) { console.error('listLeads:', error.message); throw new Error(error.message) }
  return (data ?? []) as Lead[]
}
export async function createLead(v: LeadFormValues, ctx: Ctx): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert({
    agency_id: ctx.agencyId, business_name: v.business_name.trim(), name: v.name.trim() || null,
    email: v.email.trim() || null, phone: v.phone.trim() || null, website: v.website.trim() || null,
    source: v.source.trim() || null, stage_id: v.stage_id || null, estimated_value_cents: v.estimated_value_cents,
    owner_id: v.owner_id || ctx.actorId, notes: v.notes.trim() || null, created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create lead')
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'lead.created', entityType: 'lead', entityId: data.id, description: `Created lead: ${v.business_name.trim()}` })
  await addActivity(data.id, 'created', 'Lead created', ctx)
  return data as Lead
}
export async function updateLead(id: string, v: LeadFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('leads').update({
    business_name: v.business_name.trim(), name: v.name.trim() || null, email: v.email.trim() || null,
    phone: v.phone.trim() || null, website: v.website.trim() || null, source: v.source.trim() || null,
    stage_id: v.stage_id || null, estimated_value_cents: v.estimated_value_cents, owner_id: v.owner_id || null,
    notes: v.notes.trim() || null, updated_by: ctx.actorId,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'lead.updated', entityType: 'lead', entityId: id, description: `Updated lead: ${v.business_name.trim()}` })
}
export async function moveLeadStage(lead: Lead, stageId: string, stageName: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('leads').update({ stage_id: stageId, updated_by: ctx.actorId }).eq('id', lead.id)
  if (error) throw new Error(error.message)
  await addActivity(lead.id, 'stage_changed', `Moved to ${stageName}`, ctx)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'lead.moved_stage', entityType: 'lead', entityId: lead.id, description: `Moved "${lead.business_name}" to ${stageName}` })
}
export async function archiveLead(lead: Lead, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('leads').update({ status: 'archived', updated_by: ctx.actorId }).eq('id', lead.id)
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'lead.archived', entityType: 'lead', entityId: lead.id, description: `Archived lead: ${lead.business_name}` })
}

export async function listNotes(leadId: string): Promise<LeadNote[]> {
  const { data } = await supabase.from('lead_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
  return (data ?? []) as LeadNote[]
}
export async function addNote(leadId: string, body: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('lead_notes').insert({ agency_id: ctx.agencyId, lead_id: leadId, author_id: ctx.actorId, body: body.trim() })
  if (error) throw new Error(error.message)
  await addActivity(leadId, 'note', 'Note added', ctx)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'lead.note_added', entityType: 'lead', entityId: leadId, description: 'Added a lead note' })
}
export async function listActivities(leadId: string): Promise<LeadActivity[]> {
  const { data } = await supabase.from('lead_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
  return (data ?? []) as LeadActivity[]
}
export async function addActivity(leadId: string, type: string, description: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('lead_activities').insert({ agency_id: ctx.agencyId, lead_id: leadId, actor_id: ctx.actorId, type, description })
  if (error) console.error('addActivity:', error.message)
}
