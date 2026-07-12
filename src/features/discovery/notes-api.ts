import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { DiscoveryNote, DiscoveryNoteSource } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export async function listDiscoveryNotes(clientId: string): Promise<DiscoveryNote[]> {
  const { data, error } = await supabase
    .from('client_discovery_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) { console.error('listDiscoveryNotes:', error.message); throw new Error(error.message) }
  return (data ?? []) as DiscoveryNote[]
}

export interface DiscoveryNoteFormValues {
  title: string
  body: string
  source: DiscoveryNoteSource | ''
}

export async function createDiscoveryNote(clientId: string, values: DiscoveryNoteFormValues, ctx: Ctx): Promise<DiscoveryNote> {
  const { data, error } = await supabase
    .from('client_discovery_notes')
    .insert({
      agency_id:  ctx.agencyId,
      client_id:  clientId,
      title:      values.title.trim(),
      body:       values.body.trim(),
      source:     values.source || null,
      author_id:  ctx.actorId,
    })
    .select('*')
    .single()
  if (error) { console.error('createDiscoveryNote:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'discovery_note.created', entityType: 'discovery_note', entityId: data.id,
    description: `Added discovery note: ${values.title.trim()}`,
  })
  return data as DiscoveryNote
}

export async function updateDiscoveryNote(id: string, clientId: string, values: DiscoveryNoteFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('client_discovery_notes')
    .update({
      title:  values.title.trim(),
      body:   values.body.trim(),
      source: values.source || null,
    })
    .eq('id', id)
  if (error) { console.error('updateDiscoveryNote:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'discovery_note.updated', entityType: 'discovery_note', entityId: id,
    description: `Updated discovery note: ${values.title.trim()}`,
  })
}

export async function deleteDiscoveryNote(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('client_discovery_notes').delete().eq('id', id)
  if (error) { console.error('deleteDiscoveryNote:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'discovery_note.deleted', entityType: 'discovery_note',
    description: 'Deleted a discovery note',
  })
}
