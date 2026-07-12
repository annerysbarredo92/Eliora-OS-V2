import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Client, ClientStatus, DashboardMetrics } from '@/types'

const CLIENT_SELECT = '*, client_contacts(*), pipeline_stages!clients_stage_id_fkey(*)'

export interface ClientFormValues {
  business_name: string
  industry: string
  website: string
  business_phone: string
  business_address: string
  status: ClientStatus
  internal_notes: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
}

interface Ctx {
  agencyId: string
  actorId: string
}

/** Build editable form values from a loaded client (+ its primary contact). */
export function clientToFormValues(client: Client): ClientFormValues {
  const primary = client.client_contacts?.find(c => c.is_primary) ?? client.client_contacts?.[0]
  return {
    business_name:      client.business_name ?? '',
    industry:           client.industry ?? '',
    website:            client.website ?? '',
    business_phone:     client.business_phone ?? '',
    business_address:   client.business_address ?? '',
    status:             client.status,
    internal_notes:     client.internal_notes ?? '',
    contact_first_name: primary?.first_name ?? '',
    contact_last_name:  primary?.last_name ?? '',
    contact_email:      primary?.email ?? '',
    contact_phone:      primary?.phone ?? '',
  }
}

/* ── Reads ───────────────────────────────────────────────── */

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listClients failed:', error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as Client[]
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getClient failed:', error.message)
    throw new Error(error.message)
  }
  return (data as Client) ?? null
}

export function computeMetrics(clients: Client[]): DashboardMetrics {
  const m: DashboardMetrics = { total: 0, active: 0, onboarding: 0, archived: 0, paused: 0, lead: 0 }
  for (const c of clients) {
    m.total++
    m[c.status]++
  }
  return m
}

/* ── Writes ──────────────────────────────────────────────── */

export async function createClient(values: ClientFormValues, ctx: Ctx): Promise<Client> {
  // 1. clients row
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .insert({
      agency_id:        ctx.agencyId,
      business_name:    values.business_name.trim(),
      industry:         values.industry.trim() || null,
      website:          values.website.trim() || null,
      business_phone:   values.business_phone.trim() || null,
      business_address: values.business_address.trim() || null,
      status:           values.status,
      internal_notes:   values.internal_notes.trim() || null,
      created_by:       ctx.actorId,
      updated_by:       ctx.actorId,
    })
    .select(CLIENT_SELECT)
    .single()

  if (clientErr || !client) {
    console.error('createClient failed:', clientErr?.message)
    throw new Error(clientErr?.message ?? 'Could not create client')
  }

  // 2. primary contact (only if any contact field provided)
  const hasContact =
    values.contact_first_name || values.contact_last_name ||
    values.contact_email || values.contact_phone

  if (hasContact) {
    const { error: contactErr } = await supabase.from('client_contacts').insert({
      agency_id:  ctx.agencyId,
      client_id:  client.id,
      first_name: values.contact_first_name.trim(),
      last_name:  values.contact_last_name.trim(),
      email:      values.contact_email.trim() || null,
      phone:      values.contact_phone.trim() || null,
      is_primary: true,
      created_by: ctx.actorId,
      updated_by: ctx.actorId,
    })
    if (contactErr) console.error('create primary contact failed:', contactErr.message)
  }

  // 3. activity
  await logActivity({
    agencyId:    ctx.agencyId,
    actorId:     ctx.actorId,
    action:      'client.created',
    entityType:  'client',
    entityId:    client.id,
    clientId:    client.id,
    description: `Created client ${values.business_name.trim()}`,
  })

  return (await getClient(client.id)) ?? (client as Client)
}

export async function updateClient(id: string, values: ClientFormValues, ctx: Ctx): Promise<Client> {
  // 1. clients row
  const { error: clientErr } = await supabase
    .from('clients')
    .update({
      business_name:    values.business_name.trim(),
      industry:         values.industry.trim() || null,
      website:          values.website.trim() || null,
      business_phone:   values.business_phone.trim() || null,
      business_address: values.business_address.trim() || null,
      status:           values.status,
      internal_notes:   values.internal_notes.trim() || null,
      updated_by:       ctx.actorId,
    })
    .eq('id', id)

  if (clientErr) {
    console.error('updateClient failed:', clientErr.message)
    throw new Error(clientErr.message)
  }

  // 2. primary contact — update existing or insert if missing
  const existing = await getClient(id)
  const primary = existing?.client_contacts?.find(c => c.is_primary) ?? existing?.client_contacts?.[0]

  const contactPayload = {
    first_name: values.contact_first_name.trim(),
    last_name:  values.contact_last_name.trim(),
    email:      values.contact_email.trim() || null,
    phone:      values.contact_phone.trim() || null,
    is_primary: true,
    updated_by: ctx.actorId,
  }

  if (primary) {
    const { error } = await supabase.from('client_contacts').update(contactPayload).eq('id', primary.id)
    if (error) console.error('update primary contact failed:', error.message)
  } else if (contactPayload.first_name || contactPayload.last_name || contactPayload.email || contactPayload.phone) {
    const { error } = await supabase.from('client_contacts').insert({
      ...contactPayload,
      agency_id:  ctx.agencyId,
      client_id:  id,
      created_by: ctx.actorId,
    })
    if (error) console.error('insert primary contact failed:', error.message)
  }

  // 3. activity
  await logActivity({
    agencyId:    ctx.agencyId,
    actorId:     ctx.actorId,
    action:      'client.updated',
    entityType:  'client',
    entityId:    id,
    clientId:    id,
    description: `Updated client ${values.business_name.trim()}`,
  })

  return (await getClient(id)) as Client
}

export async function updateCompanyInfo(
  id: string,
  patch: Partial<{
    business_name: string
    industry: string | null
    sub_industry: string | null
    website: string | null
    business_email: string | null
    business_phone: string | null
    business_address: string | null
    location: string | null
    timezone: string | null
    company_description: string | null
  }>,
  ctx: Ctx,
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ ...patch, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('updateCompanyInfo:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: id,
    action: 'client.updated', entityType: 'client', entityId: id,
    description: `Updated company information${patch.business_name ? ` for ${patch.business_name}` : ''}`,
  })
}

export async function updateDiscoveryData(
  id: string,
  patch: Record<string, unknown>,
  ctx: Ctx,
): Promise<void> {
  const { error } = await supabase.rpc('patch_client_discovery_data', {
    p_client_id: id,
    p_patch:     patch,
  })
  if (error) { console.error('updateDiscoveryData:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: id,
    action: 'client.updated', entityType: 'client', entityId: id,
    description: 'Updated client discovery data',
  })
}

/* ── Contact CRUD ────────────────────────────────────────── */

export interface ContactFormValues {
  first_name: string
  last_name: string
  title: string
  email: string
  phone: string
  is_primary: boolean
  roles: string[]
  preferred_communication: string
  birthday: string
  notes: string
}

export async function findContactByEmail(
  email: string,
  clientId: string,
  excludeContactId?: string,
): Promise<import('@/types').ClientContact | null> {
  const trimmed = email.trim()
  if (!trimmed) return null

  // Server-side case-insensitive match scoped to this client only.
  // RLS further enforces agency ownership.
  let q = supabase
    .from('client_contacts')
    .select('*')
    .eq('client_id', clientId)
    .ilike('email', trimmed)
    .limit(1)

  if (excludeContactId) q = q.neq('id', excludeContactId)

  const { data } = await q
  return (data?.[0] as import('@/types').ClientContact) ?? null
}

export async function createContact(
  clientId: string,
  values: ContactFormValues,
  ctx: Ctx,
): Promise<void> {
  const payload = {
    agency_id:                ctx.agencyId,
    client_id:                clientId,
    first_name:               values.first_name.trim(),
    last_name:                values.last_name.trim() || null,
    title:                    values.title.trim() || null,
    email:                    values.email.trim() || null,
    phone:                    values.phone.trim() || null,
    is_primary:               false,
    roles:                    values.roles,
    preferred_communication:  values.preferred_communication || null,
    birthday:                 values.birthday || null,
    notes:                    values.notes.trim() || null,
    created_by:               ctx.actorId,
    updated_by:               ctx.actorId,
  }

  const { data, error } = await supabase
    .from('client_contacts')
    .insert(payload)
    .select('id')
    .single()

  if (error) { console.error('createContact:', error.message); throw new Error(error.message) }

  if (values.is_primary && data?.id) {
    const { error: rpcErr } = await supabase.rpc('set_primary_contact', {
      p_client_id:  clientId,
      p_contact_id: data.id,
    })
    if (rpcErr) {
      console.error('set_primary_contact (create):', rpcErr.message)
      throw new Error('Contact saved but could not assign as primary. Please retry from the contact list.')
    }
  }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'contact.created', entityType: 'contact',
    description: `Added contact: ${payload.first_name}${payload.last_name ? ' ' + payload.last_name : ''}`,
  })
}

export async function updateContact(
  contactId: string,
  clientId: string,
  values: ContactFormValues,
  ctx: Ctx,
): Promise<void> {
  const dataFields = {
    first_name:               values.first_name.trim(),
    last_name:                values.last_name.trim() || null,
    title:                    values.title.trim() || null,
    email:                    values.email.trim() || null,
    phone:                    values.phone.trim() || null,
    roles:                    values.roles,
    preferred_communication:  values.preferred_communication || null,
    birthday:                 values.birthday || null,
    notes:                    values.notes.trim() || null,
    updated_by:               ctx.actorId,
  }

  const { error } = await supabase
    .from('client_contacts')
    .update(dataFields)
    .eq('id', contactId)

  if (error) { console.error('updateContact:', error.message); throw new Error(error.message) }

  // Primary is only ever assigned via the atomic RPC, which demotes the previous
  // primary in the same transaction. Directly writing is_primary=false is removed
  // because the UI prevents unchecking primary on the current primary contact.
  if (values.is_primary) {
    const { error: rpcErr } = await supabase.rpc('set_primary_contact', {
      p_client_id:  clientId,
      p_contact_id: contactId,
    })
    if (rpcErr) {
      console.error('set_primary_contact (update):', rpcErr.message)
      throw new Error('Contact saved but could not assign as primary. Please retry.')
    }
  }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'contact.updated', entityType: 'contact',
    description: `Updated contact: ${dataFields.first_name}${dataFields.last_name ? ' ' + dataFields.last_name : ''}`,
  })
}

export async function deleteContact(
  contactId: string,
  clientId: string,
  ctx: Ctx,
): Promise<void> {
  const { error } = await supabase.from('client_contacts').delete().eq('id', contactId)
  if (error) throw new Error(error.message)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'contact.deleted', entityType: 'contact',
    description: 'Deleted a contact',
  })
}

export async function archiveClient(client: Client, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ status: 'archived', updated_by: ctx.actorId })
    .eq('id', client.id)

  if (error) {
    console.error('archiveClient failed:', error.message)
    throw new Error(error.message)
  }

  await logActivity({
    agencyId:    ctx.agencyId,
    actorId:     ctx.actorId,
    action:      'client.archived',
    entityType:  'client',
    entityId:    client.id,
    clientId:    client.id,
    description: `Archived client ${client.business_name}`,
  })
}
