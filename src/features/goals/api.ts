import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Goal, Kpi, GoalStatus } from '@/types'

interface Ctx { agencyId: string; actorId: string }

/* ── Goals ───────────────────────────────────────────────── */

export async function listGoals(clientId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
  if (error) { console.error('listGoals:', error.message); throw new Error(error.message) }
  return (data ?? []) as Goal[]
}

export async function listArchivedGoals(clientId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_archived', true)
    .order('archived_at', { ascending: false })
  if (error) { console.error('listArchivedGoals:', error.message); throw new Error(error.message) }
  return (data ?? []) as Goal[]
}

export interface GoalFormValues {
  title: string
  description: string
  target_value: number
  current_value: number
  due_date: string
  time_period: string
  status: GoalStatus
  owner: string
  is_client_visible: boolean
}

export async function createGoal(clientId: string, values: GoalFormValues, ctx: Ctx): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      agency_id:        ctx.agencyId,
      client_id:        clientId,
      title:            values.title.trim(),
      description:      values.description.trim() || null,
      target_value:     values.target_value,
      current_value:    values.current_value,
      due_date:         values.due_date || null,
      time_period:      values.time_period.trim() || null,
      status:           values.status,
      owner:            values.owner.trim() || null,
      is_client_visible: values.is_client_visible,
      created_by:       ctx.actorId,
      updated_by:       ctx.actorId,
    })
    .select('*')
    .single()
  if (error) { console.error('createGoal:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'goal.created', entityType: 'goal', entityId: data.id,
    description: `Created goal: ${values.title.trim()}`,
  })
  return data as Goal
}

export async function updateGoal(id: string, clientId: string, values: GoalFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({
      title:            values.title.trim(),
      description:      values.description.trim() || null,
      target_value:     values.target_value,
      current_value:    values.current_value,
      due_date:         values.due_date || null,
      time_period:      values.time_period.trim() || null,
      status:           values.status,
      owner:            values.owner.trim() || null,
      is_client_visible: values.is_client_visible,
      updated_by:       ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateGoal:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'goal.updated', entityType: 'goal', entityId: id,
    description: `Updated goal: ${values.title.trim()}`,
  })
}

export async function updateGoalProgress(id: string, clientId: string, currentValue: number, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ current_value: currentValue, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('updateGoalProgress:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'goal.updated', entityType: 'goal', entityId: id,
    description: `Updated goal progress to ${currentValue}`,
  })
}

export async function archiveGoal(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ is_archived: true, archived_at: new Date().toISOString(), updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('archiveGoal:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'goal.archived', entityType: 'goal', entityId: id,
    description: 'Archived a goal',
  })
}

export async function restoreGoal(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ is_archived: false, archived_at: null, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('restoreGoal:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'goal.restored', entityType: 'goal', entityId: id,
    description: 'Restored a goal',
  })
}

export async function deleteGoal(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) { console.error('deleteGoal:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'goal.deleted', entityType: 'goal',
    description: 'Deleted a goal',
  })
}

/* ── KPIs ────────────────────────────────────────────────── */

export async function listKpis(clientId: string): Promise<Kpi[]> {
  const { data, error } = await supabase
    .from('kpis')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
  if (error) { console.error('listKpis:', error.message); throw new Error(error.message) }
  return (data ?? []) as Kpi[]
}

export async function listArchivedKpis(clientId: string): Promise<Kpi[]> {
  const { data, error } = await supabase
    .from('kpis')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_archived', true)
    .order('archived_at', { ascending: false })
  if (error) { console.error('listArchivedKpis:', error.message); throw new Error(error.message) }
  return (data ?? []) as Kpi[]
}

export interface KpiFormValues {
  name: string
  description: string
  metric_key: string
  target_value: number
  current_value: number
  unit: string
  period: string
  goal_id: string
  owner: string
  status: Kpi['status']
  is_client_visible: boolean
}

export async function createKpi(clientId: string, values: KpiFormValues, ctx: Ctx): Promise<Kpi> {
  const { data, error } = await supabase
    .from('kpis')
    .insert({
      agency_id:        ctx.agencyId,
      client_id:        clientId,
      name:             values.name.trim(),
      description:      values.description.trim() || null,
      metric_key:       values.metric_key.trim() || null,
      target_value:     values.target_value,
      current_value:    values.current_value,
      unit:             values.unit.trim() || null,
      period:           values.period.trim() || null,
      goal_id:          values.goal_id || null,
      owner:            values.owner.trim() || null,
      status:           values.status,
      is_client_visible: values.is_client_visible,
      created_by:       ctx.actorId,
      updated_by:       ctx.actorId,
    })
    .select('*')
    .single()
  if (error) { console.error('createKpi:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'kpi.created', entityType: 'kpi', entityId: data.id,
    description: `Created KPI: ${values.name.trim()}`,
  })
  return data as Kpi
}

export async function updateKpi(id: string, clientId: string, values: KpiFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('kpis')
    .update({
      name:             values.name.trim(),
      description:      values.description.trim() || null,
      metric_key:       values.metric_key.trim() || null,
      target_value:     values.target_value,
      current_value:    values.current_value,
      unit:             values.unit.trim() || null,
      period:           values.period.trim() || null,
      goal_id:          values.goal_id || null,
      owner:            values.owner.trim() || null,
      status:           values.status,
      is_client_visible: values.is_client_visible,
      updated_by:       ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateKpi:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'kpi.updated', entityType: 'kpi', entityId: id,
    description: `Updated KPI: ${values.name.trim()}`,
  })
}

export async function updateKpiCurrentValue(id: string, clientId: string, currentValue: number, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('kpis')
    .update({ current_value: currentValue, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('updateKpiCurrentValue:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'kpi.updated', entityType: 'kpi', entityId: id,
    description: `Updated KPI current value to ${currentValue}`,
  })
}

export async function archiveKpi(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('kpis')
    .update({ is_archived: true, archived_at: new Date().toISOString(), updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('archiveKpi:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'kpi.archived', entityType: 'kpi', entityId: id,
    description: 'Archived a KPI',
  })
}

export async function restoreKpi(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('kpis')
    .update({ is_archived: false, archived_at: null, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('restoreKpi:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'kpi.restored', entityType: 'kpi', entityId: id,
    description: 'Restored a KPI',
  })
}

export async function deleteKpi(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('kpis').delete().eq('id', id)
  if (error) { console.error('deleteKpi:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'kpi.deleted', entityType: 'kpi',
    description: 'Deleted a KPI',
  })
}
