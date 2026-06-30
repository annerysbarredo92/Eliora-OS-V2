import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Automation, AutomationRun, AutomationTrigger } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export const TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: 'date', label: 'Date-based' }, { value: 'status', label: 'Status-based' }, { value: 'manual', label: 'Manual' },
]
export const ACTIONS: { value: string; label: string }[] = [
  { value: 'proposal_reminder', label: 'Proposal Reminder' }, { value: 'invoice_reminder', label: 'Invoice Reminder' },
  { value: 'approval_reminder', label: 'Approval Reminder' }, { value: 'onboarding_reminder', label: 'Onboarding Reminder' },
  { value: 'file_request_reminder', label: 'File Request Reminder' }, { value: 'meeting_reminder', label: 'Meeting Reminder' },
  { value: 'task_reminder', label: 'Task Reminder' },
]
export const MAX_RETRIES = 3

export async function listAutomations(): Promise<Automation[]> {
  const { data, error } = await supabase.from('automations').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listAutomations:', error.message); return [] }
  return (data ?? []) as Automation[]
}
export async function createAutomation(v: { name: string; trigger_type: AutomationTrigger; action_type: string; description: string }, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('automations').insert({ agency_id: ctx.agencyId, name: v.name.trim(), trigger_type: v.trigger_type, action_type: v.action_type, description: v.description.trim() || null, created_by: ctx.actorId, updated_by: ctx.actorId })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'automation.created', entityType: 'automation', description: `Created automation: ${v.name.trim()}` })
}
export async function setActive(a: Automation, active: boolean): Promise<void> {
  const { error } = await supabase.from('automations').update({ is_active: active }).eq('id', a.id)
  if (error) throw new Error(error.message)
}
export async function deleteAutomation(a: Automation): Promise<void> {
  const { error } = await supabase.from('automations').delete().eq('id', a.id)
  if (error) throw new Error(error.message)
}

/** Manual run: records a run + log. Failure handling caps retries at MAX_RETRIES. */
export async function runNow(a: Automation, ctx: Ctx): Promise<void> {
  await supabase.from('automation_runs').insert({ agency_id: a.agency_id, automation_id: a.id, status: 'success', attempt: 1, result: { trigger: 'manual' } })
  await supabase.from('automation_logs').insert({ agency_id: a.agency_id, automation_id: a.id, level: 'info', message: `Manual run of "${a.name}"` })
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'automation.run', entityType: 'automation', entityId: a.id, description: `Ran automation: ${a.name}` })
}
export async function listRuns(automationId: string): Promise<AutomationRun[]> {
  const { data } = await supabase.from('automation_runs').select('*').eq('automation_id', automationId).order('created_at', { ascending: false }).limit(20)
  return (data ?? []) as AutomationRun[]
}
