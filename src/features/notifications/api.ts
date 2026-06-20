import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

export async function listNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  if (error) { console.error('listNotifications:', error.message); return [] }
  return (data ?? []) as Notification[]
}
export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) console.error('markRead:', error.message)
}
export async function markAllRead(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids)
  if (error) console.error('markAllRead:', error.message)
}

/** Create a notification for a recipient. */
export async function notify(opts: { agencyId: string; recipientId: string; clientId?: string | null; type: string; title: string; body?: string; entityType?: string; entityId?: string }): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    agency_id: opts.agencyId, recipient_profile_id: opts.recipientId, client_id: opts.clientId ?? null,
    type: opts.type, title: opts.title, body: opts.body ?? null, entity_type: opts.entityType ?? null, entity_id: opts.entityId ?? null,
  })
  if (error) console.error('notify:', error.message)
}
