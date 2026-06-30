import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Message, MessageKind } from '@/types'

interface Ctx { agencyId: string; clientId: string; actorId: string; role: 'agency' | 'client' }

export async function ensureThread(clientId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_message_thread', { _client_id: clientId })
  if (error) { console.error('ensure_message_thread:', error.message); return null }
  return data as string
}

export async function listMessages(threadId: string, kind?: MessageKind): Promise<Message[]> {
  let q = supabase.from('messages').select('*').eq('thread_id', threadId)
  if (kind) q = q.eq('kind', kind)
  else q = q.neq('kind', 'internal_note')  // default: exclude internal notes from generic list
  const { data, error } = await q.order('created_at')
  if (error) { console.error('listMessages:', error.message); return [] }
  return (data ?? []) as Message[]
}

export async function listAllKindMessages(threadId: string, kind: MessageKind): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages').select('*').eq('thread_id', threadId).eq('kind', kind).order('created_at')
  if (error) { console.error('listAllKindMessages:', error.message); return [] }
  return (data ?? []) as Message[]
}

export async function sendMessage(
  threadId: string,
  body: string,
  ctx: Ctx,
  kind: MessageKind = 'chat',
  subject?: string,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    agency_id: ctx.agencyId,
    client_id: ctx.clientId,
    thread_id: threadId,
    author_id: ctx.actorId,
    author_role: ctx.role,
    body: body.trim(),
    kind,
    subject: subject?.trim() || null,
    is_client_visible: kind !== 'internal_note',
  })
  if (error) throw new Error(error.message)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: ctx.role === 'client' ? 'message.sent_by_client' : `message.${kind}`,
    entityType: 'message',
    description: kind === 'chat' ? 'Sent a message' : `Added ${kind.replace('_', ' ')}`,
  })
}
