import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Retainer, RetainerStatus, RetainerFrequency, RetainerIncludedService } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export interface RetainerFormValues {
  title: string
  description: string
  status: RetainerStatus
  frequency: RetainerFrequency
  amount_cents: number
  start_date: string
  end_date: string
  next_billing_date: string
  is_auto_renew: boolean
  included_services: RetainerIncludedService[]
  linked_proposal_id: string
  linked_contract_id: string
  notes: string
}

export interface RenewRetainerValues {
  new_amount_cents: number
  new_frequency: RetainerFrequency
  new_start_date: string
  new_end_date: string
  new_next_billing: string
  notes: string
}

export const FREQUENCY_LABELS: Record<RetainerFrequency, string> = {
  weekly:    'Weekly',
  biweekly:  'Bi-weekly',
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  annually:  'Annually',
  custom:    'Custom',
}

export const STATUS_LABELS: Record<RetainerStatus, string> = {
  draft:   'Draft',
  active:  'Active',
  paused:  'Paused',
  ending:  'Ending',
  ended:   'Ended',
}

// Approved lifecycle transitions. Keys = current status. Values = allowed next statuses.
export const ALLOWED_TRANSITIONS: Record<RetainerStatus, RetainerStatus[]> = {
  draft:   ['active'],
  active:  ['paused', 'ending', 'ended'],
  paused:  ['active', 'ending', 'ended'],
  ending:  ['ended'],
  ended:   [],
}

export function canTransition(from: RetainerStatus, to: RetainerStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export async function listRetainers(clientId: string): Promise<Retainer[]> {
  const { data, error } = await supabase
    .from('retainers')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) { console.error('listRetainers:', error.message); throw new Error(error.message) }
  return (data ?? []) as Retainer[]
}

export async function createRetainer(clientId: string, values: RetainerFormValues, ctx: Ctx): Promise<Retainer> {
  const { data, error } = await supabase
    .from('retainers')
    .insert({
      agency_id:           ctx.agencyId,
      client_id:           clientId,
      title:               values.title.trim(),
      description:         values.description.trim() || null,
      status:              values.status,
      frequency:           values.frequency,
      amount_cents:        values.amount_cents,
      start_date:          values.start_date || null,
      end_date:            values.end_date || null,
      next_billing_date:   values.next_billing_date || null,
      is_auto_renew:       values.is_auto_renew,
      included_services:   values.included_services,
      linked_proposal_id:  values.linked_proposal_id || null,
      linked_contract_id:  values.linked_contract_id || null,
      notes:               values.notes.trim() || null,
      created_by:          ctx.actorId,
      updated_by:          ctx.actorId,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create retainer')
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'retainer.created', entityType: 'retainer', entityId: data.id,
    description: `Created retainer: ${values.title.trim()}`,
  })
  return data as Retainer
}

export async function updateRetainer(id: string, clientId: string, values: RetainerFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('retainers')
    .update({
      title:              values.title.trim(),
      description:        values.description.trim() || null,
      status:             values.status,
      frequency:          values.frequency,
      amount_cents:       values.amount_cents,
      start_date:         values.start_date || null,
      end_date:           values.end_date || null,
      next_billing_date:  values.next_billing_date || null,
      is_auto_renew:      values.is_auto_renew,
      included_services:  values.included_services,
      linked_proposal_id: values.linked_proposal_id || null,
      linked_contract_id: values.linked_contract_id || null,
      notes:              values.notes.trim() || null,
      updated_by:         ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateRetainer:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'retainer.updated', entityType: 'retainer', entityId: id,
    description: `Updated retainer: ${values.title.trim()}`,
  })
}

export async function setRetainerStatus(
  retainer: Retainer,
  to: RetainerStatus,
  ctx: Ctx,
): Promise<void> {
  if (!canTransition(retainer.status, to)) {
    throw new Error(`Invalid transition: ${retainer.status} → ${to}`)
  }
  const updates: Record<string, unknown> = { status: to, updated_by: ctx.actorId }
  if (to === 'paused')  updates.paused_at = new Date().toISOString()
  if (to === 'ended')   updates.ended_at  = new Date().toISOString()
  if (to === 'active')  updates.paused_at = null   // clear paused_at on resume

  const { error } = await supabase.from('retainers').update(updates).eq('id', retainer.id)
  if (error) { console.error('setRetainerStatus:', error.message); throw new Error(error.message) }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: retainer.client_id,
    action: 'retainer.status_changed', entityType: 'retainer', entityId: retainer.id,
    description: `Retainer "${retainer.title}" → ${STATUS_LABELS[to]}`,
  })
}

// renewRetainer calls the DB RPC that atomically ends the old retainer
// and creates a new one linked via previous_retainer_id.
export async function renewRetainer(
  retainer: Retainer,
  values: RenewRetainerValues,
  ctx: Ctx,
): Promise<Retainer> {
  if (!['active', 'paused', 'ending'].includes(retainer.status)) {
    throw new Error(`Only active, paused, or ending retainers can be renewed; status is ${retainer.status}`)
  }
  const { data, error } = await supabase.rpc('renew_retainer', {
    p_old_id:           retainer.id,
    p_new_amount_cents: values.new_amount_cents,
    p_new_frequency:    values.new_frequency,
    p_new_start_date:   values.new_start_date || null,
    p_new_end_date:     values.new_end_date || null,
    p_new_next_billing: values.new_next_billing || null,
    p_notes:            values.notes.trim() || null,
    p_actor_id:         ctx.actorId,
  })
  if (error) { console.error('renewRetainer:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: retainer.client_id,
    action: 'retainer.renewed', entityType: 'retainer', entityId: retainer.id,
    description: `Renewed retainer: ${retainer.title}`,
  })
  return data as Retainer
}

// deleteRetainer: only permitted for draft retainers. The DB RLS policy
// enforces this at the DB level; this guard provides a clear error at the API level.
export async function deleteRetainer(retainer: Retainer, ctx: Ctx): Promise<void> {
  if (retainer.status !== 'draft') {
    throw new Error(`Only draft retainers can be deleted. Use End to conclude an active retainer.`)
  }
  const { error } = await supabase.from('retainers').delete().eq('id', retainer.id)
  if (error) { console.error('deleteRetainer:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: retainer.client_id,
    action: 'retainer.deleted', entityType: 'retainer', entityId: retainer.id,
    description: `Deleted draft retainer: ${retainer.title}`,
  })
}
