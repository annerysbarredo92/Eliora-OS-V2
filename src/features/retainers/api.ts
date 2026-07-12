import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Retainer, RetainerStatus, RetainerFrequency } from '@/types'

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
  active:    'Active',
  paused:    'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
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
      agency_id:         ctx.agencyId,
      client_id:         clientId,
      title:             values.title.trim(),
      description:       values.description.trim() || null,
      status:            values.status,
      frequency:         values.frequency,
      amount_cents:      values.amount_cents,
      start_date:        values.start_date || null,
      end_date:          values.end_date || null,
      next_billing_date: values.next_billing_date || null,
      is_auto_renew:     values.is_auto_renew,
      notes:             values.notes.trim() || null,
      created_by:        ctx.actorId,
      updated_by:        ctx.actorId,
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
      title:             values.title.trim(),
      description:       values.description.trim() || null,
      status:            values.status,
      frequency:         values.frequency,
      amount_cents:      values.amount_cents,
      start_date:        values.start_date || null,
      end_date:          values.end_date || null,
      next_billing_date: values.next_billing_date || null,
      is_auto_renew:     values.is_auto_renew,
      notes:             values.notes.trim() || null,
      updated_by:        ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateRetainer:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'retainer.updated', entityType: 'retainer', entityId: id,
    description: `Updated retainer: ${values.title.trim()}`,
  })
}

export async function setRetainerStatus(id: string, clientId: string, status: RetainerStatus, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('retainers')
    .update({ status, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('setRetainerStatus:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'retainer.updated', entityType: 'retainer', entityId: id,
    description: `Set retainer status to ${status}`,
  })
}

export async function deleteRetainer(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('retainers').delete().eq('id', id)
  if (error) { console.error('deleteRetainer:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'retainer.deleted', entityType: 'retainer',
    description: 'Deleted a retainer',
  })
}
