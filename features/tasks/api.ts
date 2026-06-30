import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Task, TaskStatus, TaskPriority, CalendarEvent, CalendarEventType } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' }, { value: 'blocked', label: 'Blocked' }, { value: 'done', label: 'Done' },
]
export const PRIORITY_BADGE: Record<TaskPriority, 'default' | 'info' | 'warning' | 'danger'> = { low: 'default', medium: 'info', high: 'warning', urgent: 'danger' }

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listTasks:', error.message); throw new Error(error.message) }
  return (data ?? []) as Task[]
}
export async function createTask(v: { title: string; description: string; priority: TaskPriority; due_date: string; client_id: string | null; assigned_to: string | null }, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('tasks').insert({ agency_id: ctx.agencyId, title: v.title.trim(), description: v.description.trim() || null, priority: v.priority, due_date: v.due_date || null, client_id: v.client_id, assigned_to: v.assigned_to, created_by: ctx.actorId })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: v.client_id, action: 'task.created', entityType: 'task', description: `Created task: ${v.title.trim()}` })
}
export async function setTaskStatus(t: Task, status: TaskStatus): Promise<void> {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', t.id)
  if (error) throw new Error(error.message)
}
export async function deleteTask(t: Task): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', t.id)
  if (error) throw new Error(error.message)
}

/* Calendar */
export const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  content: 'Content', discovery_call: 'Discovery Call', client_meeting: 'Client Meeting', internal_meeting: 'Internal Meeting',
  deadline: 'Deadline', invoice_due: 'Invoice Due', proposal_expiration: 'Proposal Expiry', task: 'Task',
}
export async function listEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.from('calendar_events').select('*').order('start_at')
  if (error) { console.error('listEvents:', error.message); throw new Error(error.message) }
  return (data ?? []) as CalendarEvent[]
}
export async function listClientEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.from('calendar_client').select('*').order('start_at')
  if (error) { console.error('listClientEvents:', error.message); return [] }
  return (data ?? []) as CalendarEvent[]
}
export async function createEvent(v: { title: string; type: CalendarEventType; start_at: string; client_id: string | null; is_client_visible: boolean; notes: string }, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('calendar_events').insert({ agency_id: ctx.agencyId, title: v.title.trim(), type: v.type, start_at: v.start_at || null, client_id: v.client_id, is_client_visible: v.is_client_visible, notes: v.notes.trim() || null, created_by: ctx.actorId })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: v.client_id, action: 'calendar.event_created', entityType: 'calendar_event', description: `Scheduled: ${v.title.trim()}` })
}
