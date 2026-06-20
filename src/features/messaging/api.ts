import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Message } from '@/types'

interface Ctx { agencyId: string; clientId: string; actorId: string; role: 'agency' | 'client' }

export async function ensureThread(clientId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_message_thread', { _client_id: clientId })
  if (error) { console.error('ensure_message_thread:', error.message); return null }
  return data as string
}

export async function listMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('*').eq('thread_id', threadId).order('created_at')
  if (error) { console.error('listMessages:', error.message); return [] }
  return (data ?? []) as Message[]
}

export async function sendMessage(threadId: string, body: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId, thread_id: threadId,
    author_id: ctx.actorId, author_role: ctx.role, body: body.trim(),
  })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: ctx.role === 'client' ? 'message.sent_by_client' : 'message.sent', entityType: 'message', description: 'Sent a message' })
}
