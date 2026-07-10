import { supabase } from '@/lib/supabase'
import type { AgencyEmailSettings, EmailMessage } from '@/types'

/* ── Agency email settings ───────────────────────────────── */

export interface EmailSettingsFormValues {
  sender_name: string
  reply_to_email: string
  email_signature: string
  sending_enabled: boolean
}

export interface AgencyEmailDefaults {
  agency_name: string
  owner_email: string | null
  owner_display_name: string | null
}

export async function getAgencyEmailSettings(agencyId: string): Promise<AgencyEmailSettings | null> {
  const { data, error } = await supabase
    .from('agency_email_settings')
    .select('*')
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (error) { console.error('getAgencyEmailSettings:', error.message); return null }
  return (data as AgencyEmailSettings) ?? null
}

export async function getAgencyEmailDefaults(agencyId: string): Promise<AgencyEmailDefaults> {
  const { data: agency, error: agencyErr } = await supabase
    .from('agencies')
    .select('name, owner_id')
    .eq('id', agencyId)
    .maybeSingle()

  if (agencyErr || !agency) {
    console.error('getAgencyEmailDefaults agency fetch:', agencyErr?.message)
    return { agency_name: '', owner_email: null, owner_display_name: null }
  }

  let ownerEmail: string | null = null
  let ownerDisplayName: string | null = null

  if (agency.owner_id) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', agency.owner_id)
      .maybeSingle()
    ownerEmail       = owner?.email        ?? null
    ownerDisplayName = owner?.display_name ?? null
  }

  return {
    agency_name:         agency.name        ?? '',
    owner_email:         ownerEmail,
    owner_display_name:  ownerDisplayName,
  }
}

export async function upsertAgencyEmailSettings(
  agencyId: string,
  values: EmailSettingsFormValues,
): Promise<void> {
  const { error } = await supabase
    .from('agency_email_settings')
    .upsert(
      {
        agency_id:       agencyId,
        sender_name:     values.sender_name.trim(),
        reply_to_email:  values.reply_to_email.trim() || null,
        email_signature: values.email_signature.trim() || null,
        email_mode:      'shared',
        sending_enabled: values.sending_enabled,
      },
      { onConflict: 'agency_id' },
    )
  if (error) throw new Error(error.message)
}

/* ── Outbound email ──────────────────────────────────────── */

export interface SendEmailParams {
  to_email: string
  to_name?: string
  subject: string
  body_text: string
  agency_id: string
  client_id?: string
  contact_id?: string
}

export async function sendEmail(params: SendEmailParams): Promise<{ message_id: string | null }> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to_email:   params.to_email,
      to_name:    params.to_name   ?? null,
      subject:    params.subject,
      body_text:  params.body_text,
      agency_id:  params.agency_id,
      client_id:  params.client_id  ?? null,
      contact_id: params.contact_id ?? null,
    },
  })

  if (error) throw new Error(error.message ?? 'Edge Function error')

  const result = data as { ok: boolean; error?: string; message_id?: string }
  if (!result.ok) throw new Error(result.error ?? 'Failed to send email')

  return { message_id: result.message_id ?? null }
}

/* ── Email history ───────────────────────────────────────── */

export async function listEmailMessages(clientId: string): Promise<EmailMessage[]> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) { console.error('listEmailMessages:', error.message); return [] }
  return (data ?? []) as EmailMessage[]
}
