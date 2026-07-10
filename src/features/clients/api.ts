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
  patch: {
    business_name: string
    industry: string | null
    website: string | null
    business_phone: string | null
    business_address: string | null
    location: string | null
  },
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
    description: `Updated company information for ${patch.business_name}`,
  })
}

export async function updateDiscoveryData(
  id: string,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  ctx: Ctx,
): Promise<void> {
  const merged = { ...current, ...patch }
  const { error } = await supabase
    .from('clients')
    .update({ discovery_data: merged, updated_by: ctx.actorId })
    .eq('id', id)
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
}

/** Returns true if `roles` column exists on client_contacts. */
function isRolesError(err: { message?: string; code?: string }): boolean {
  return err.code === '42703' || (err.message?.toLowerCase().includes('roles') ?? false)
}

export async function createContact(
  clientId: string,
  values: ContactFormValues,
  ctx: Ctx,
): Promise<{ rolesSkipped: boolean }> {
  if (values.is_primary) {
    await supabase.from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)
      .eq('is_primary', true)
  }

  const base = {
    agency_id:  ctx.agencyId,
    client_id:  clientId,
    first_name: values.first_name.trim(),
    last_name:  values.last_name.trim() || null,
    title:      values.title.trim() || null,
    email:      values.email.trim() || null,
    phone:      values.phone.trim() || null,
    is_primary: values.is_primary,
  }

  let rolesSkipped = false
  const { error } = await supabase.from('client_contacts').insert({ ...base, roles: values.roles })
  if (error) {
    if (isRolesError(error)) {
      rolesSkipped = true
      const { error: e2 } = await supabase.from('client_contacts').insert(base)
      if (e2) throw new Error(e2.message)
    } else {
      throw new Error(error.message)
    }
  }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'contact.created', entityType: 'contact',
    description: `Added contact: ${base.first_name} ${base.last_name ?? ''}`.trim(),
  })
  return { rolesSkipped }
}

export async function updateContact(
  contactId: string,
  clientId: string,
  values: ContactFormValues,
  ctx: Ctx,
): Promise<{ rolesSkipped: boolean }> {
  if (values.is_primary) {
    await supabase.from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)
      .eq('is_primary', true)
      .neq('id', contactId)
  }

  const base = {
    first_name: values.first_name.trim(),
    last_name:  values.last_name.trim() || null,
    title:      values.title.trim() || null,
    email:      values.email.trim() || null,
    phone:      values.phone.trim() || null,
    is_primary: values.is_primary,
    updated_by: ctx.actorId,
  }

  let rolesSkipped = false
  const { error } = await supabase.from('client_contacts').update({ ...base, roles: values.roles }).eq('id', contactId)
  if (error) {
    if (isRolesError(error)) {
      rolesSkipped = true
      const { error: e2 } = await supabase.from('client_contacts').update(base).eq('id', contactId)
      if (e2) throw new Error(e2.message)
    } else {
      throw new Error(error.message)
    }
  }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'contact.updated', entityType: 'contact',
    description: `Updated contact: ${base.first_name} ${base.last_name ?? ''}`.trim(),
  })
  return { rolesSkipped }
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
