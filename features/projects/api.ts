import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import { seedStages, listStages } from '@/features/pipeline/api'
import type { Client, PipelineStage } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export interface ProjectFormValues {
  business_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  lead_source: string
  project_value_cents: number
  sales_owner_id: string
  stage_id: string
  location: string
  website: string
  industry: string
  next_action: string
}

export interface StageSummary extends PipelineStage {
  count: number
  total_cents: number
}

const PROJECT_SELECT = '*, client_contacts(*), pipeline_stages!clients_stage_id_fkey(*)'

export async function getProjectStages(agencyId: string): Promise<PipelineStage[]> {
  await seedStages(agencyId)
  return listStages()
}

export async function getPipelineSummary(agencyId: string): Promise<StageSummary[]> {
  const [{ data: stages }, { data: projects }] = await Promise.all([
    supabase.from('pipeline_stages').select('*').eq('agency_id', agencyId).order('sort_order'),
    supabase.from('clients').select('stage_id, project_value_cents').eq('agency_id', agencyId).neq('status', 'archived'),
  ])
  return (stages ?? []).map(s => ({
    ...(s as PipelineStage),
    count: (projects ?? []).filter(p => p.stage_id === s.id).length,
    total_cents: (projects ?? []).filter(p => p.stage_id === s.id).reduce((n, p) => n + (p.project_value_cents ?? 0), 0),
  }))
}

export async function listProjects(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select(PROJECT_SELECT)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  if (error) { console.error('listProjects:', error.message); return [] }
  return (data ?? []) as unknown as Client[]
}

export async function createProject(values: ProjectFormValues, ctx: Ctx): Promise<Client> {
  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      agency_id:            ctx.agencyId,
      business_name:        values.business_name.trim(),
      industry:             values.industry.trim() || null,
      website:              values.website.trim() || null,
      location:             values.location.trim() || null,
      status:               'lead',
      stage_id:             values.stage_id || null,
      project_value_cents:  values.project_value_cents || 0,
      lead_source:          values.lead_source.trim() || null,
      sales_owner_id:       values.sales_owner_id || ctx.actorId,
      next_action:          values.next_action.trim() || null,
    })
    .select(PROJECT_SELECT)
    .single()

  if (error || !client) throw new Error(error?.message ?? 'Could not create project')

  const hasContact =
    values.contact_first_name || values.contact_last_name ||
    values.contact_email      || values.contact_phone

  if (hasContact) {
    await supabase.from('client_contacts').insert({
      agency_id:  ctx.agencyId,
      client_id:  client.id,
      first_name: values.contact_first_name.trim() || 'Contact',
      last_name:  values.contact_last_name.trim()  || null,
      email:      values.contact_email.trim()       || null,
      phone:      values.contact_phone.trim()       || null,
      is_primary: true,
    })
  }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'project.created', entityType: 'client',
    entityId: client.id, clientId: client.id,
    description: `Created project: ${values.business_name.trim()}`,
  })
  return client as unknown as Client
}

export async function moveProjectStage(
  projectId: string, stageId: string, stageName: string, ctx: Ctx,
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ stage_id: stageId, updated_by: ctx.actorId })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'project.stage_changed', entityType: 'client',
    entityId: projectId, clientId: projectId,
    description: `Moved to ${stageName}`,
  })
}

export async function updateProjectFields(
  projectId: string, patch: Record<string, unknown>, ctx: Ctx,
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ ...patch, updated_by: ctx.actorId })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
}

export async function updateLeadInfo(
  projectId: string, leadInfo: Record<string, unknown>, ctx: Ctx,
): Promise<void> {
  await updateProjectFields(projectId, { lead_info: leadInfo }, ctx)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'project.lead_info_updated', entityType: 'client',
    entityId: projectId, clientId: projectId,
    description: 'Updated lead information',
  })
}

export async function updateDiscoveryData(
  projectId: string, discoveryData: Record<string, unknown>, ctx: Ctx,
): Promise<void> {
  await updateProjectFields(projectId, { discovery_data: discoveryData }, ctx)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'project.discovery_updated', entityType: 'client',
    entityId: projectId, clientId: projectId,
    description: 'Updated discovery data',
  })
}

export async function checkProposalExpiry(): Promise<void> {
  const { error } = await supabase.rpc('expire_overdue_proposals')
  if (error) console.warn('expire_overdue_proposals:', error.message)
}
