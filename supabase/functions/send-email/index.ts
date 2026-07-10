// Eliora OS — Outbound email Edge Function (Deno / Supabase Functions).
// DEBUG BUILD — dense logging at every checkpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const ts = new Date().toISOString()
  console.log(`[send-email][${ts}] ── INVOKED ── method:${req.method}`)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // ── Secrets ───────────────────────────────────────────────
  const resendKey       = Deno.env.get('RESEND_API_KEY')
  const sharedFromEmail = Deno.env.get('SHARED_FROM_EMAIL')
  console.log(`[send-email] RESEND_API_KEY set: ${Boolean(resendKey)} | SHARED_FROM_EMAIL set: ${Boolean(sharedFromEmail)} | value: ${sharedFromEmail ?? 'MISSING'}`)

  if (!resendKey)       return json({ ok: false, error: 'RESEND_API_KEY secret is not set.' })
  if (!sharedFromEmail) return json({ ok: false, error: 'SHARED_FROM_EMAIL secret is not set.' })

  // ── Auth ──────────────────────────────────────────────────
  const authHeader   = req.headers.get('Authorization') ?? ''
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
  const db = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })

  const { data: { user }, error: authErr } = await db.auth.getUser()
  console.log(`[send-email] auth: user=${user?.id ?? 'null'} err=${authErr?.message ?? 'none'}`)
  if (authErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401)

  // ── Parse body ────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return json({ ok: false, error: 'Invalid JSON body' }, 400) }

  const {
    to_email, to_name, subject,
    body_html, body_text,
    agency_id, client_id, contact_id,
  } = body as {
    to_email: string; to_name?: string; subject: string
    body_html?: string; body_text?: string
    agency_id: string; client_id?: string; contact_id?: string
  }

  console.log(`[send-email] parsed body: agency_id=${agency_id} to_email=${to_email} subject="${subject}" has_html=${Boolean(body_html)} has_text=${Boolean(body_text)}`)

  if (!to_email  || typeof to_email  !== 'string') return json({ ok: false, error: 'to_email is required'  }, 400)
  if (!subject   || typeof subject   !== 'string') return json({ ok: false, error: 'subject is required'   }, 400)
  if (!body_html && !body_text)                    return json({ ok: false, error: 'body_html or body_text is required' }, 400)
  if (!agency_id || typeof agency_id !== 'string') return json({ ok: false, error: 'agency_id is required' }, 400)

  // ── Load settings ─────────────────────────────────────────
  const { data: rawSettings, error: settingsErr } = await db
    .from('agency_email_settings')
    .select('sender_name, reply_to_email, sending_enabled, email_mode')
    .eq('agency_id', agency_id)
    .maybeSingle()

  console.log(`[send-email] settings fetch: err=${settingsErr?.message ?? 'none'} row=${JSON.stringify(rawSettings)}`)

  if (settingsErr) return json({ ok: false, error: 'Could not load email settings.' })

  // ── Lazy provision ────────────────────────────────────────
  let settings = rawSettings as {
    sender_name: string; reply_to_email: string | null
    sending_enabled: boolean; email_mode: string
  } | null

  if (!settings) {
    console.log(`[send-email] no settings row — lazy provisioning`)
    const { data: agencyRow } = await db.from('agencies').select('name, owner_id').eq('id', agency_id).maybeSingle()
    let ownerEmail: string | null = null
    if (agencyRow?.owner_id) {
      const { data: op } = await db.from('profiles').select('email').eq('id', agencyRow.owner_id).maybeSingle()
      ownerEmail = op?.email ?? null
    }
    const defaultSenderName = agencyRow?.name?.trim() || 'Your Agency'
    console.log(`[send-email] lazy provision defaults: sender_name="${defaultSenderName}" owner_email=${ownerEmail}`)

    db.from('agency_email_settings').upsert({
      agency_id, sender_name: defaultSenderName, reply_to_email: ownerEmail,
      email_signature: agencyRow?.name ?? null, email_mode: 'shared',
      sending_enabled: ownerEmail != null,
    }, { onConflict: 'agency_id' }).then((r: { error: { message: string } | null }) => {
      if (r.error) console.error(`[send-email] lazy provision upsert failed: ${r.error.message}`)
      else console.log(`[send-email] lazy provision upsert ok`)
    })

    settings = { sender_name: defaultSenderName, reply_to_email: ownerEmail, sending_enabled: ownerEmail != null, email_mode: 'shared' }
  }

  // ── Guard: sending enabled ────────────────────────────────
  console.log(`[send-email] sending_enabled=${settings.sending_enabled} sender_name="${settings.sender_name}"`)
  if (!settings.sending_enabled) {
    return json({ ok: false, error: 'Email sending is disabled. Enable it in Settings → Communication.' })
  }

  // ── Resolve sender name ───────────────────────────────────
  let senderName = settings.sender_name?.trim()
  if (!senderName) {
    const { data: ag } = await db.from('agencies').select('name').eq('id', agency_id).maybeSingle()
    senderName = ag?.name?.trim() || 'Eliora'
    console.log(`[send-email] senderName was empty, fell back to: "${senderName}"`)
  }

  // ── Build Resend payload ───────────────────────────────────
  const fromAddress = `${senderName} <${sharedFromEmail}>`
  const toAddress   = to_name ? `${to_name} <${to_email}>` : to_email
  console.log(`[send-email] from="${fromAddress}" to="${toAddress}" reply_to="${settings.reply_to_email ?? 'none'}"`)

  const resendPayload: Record<string, unknown> = { from: fromAddress, to: [toAddress], subject }
  if (settings.reply_to_email?.trim()) resendPayload.reply_to = [settings.reply_to_email.trim()]
  if (body_html) resendPayload.html = body_html
  if (body_text) resendPayload.text = body_text

  // ── Call Resend ───────────────────────────────────────────
  console.log(`[send-email] calling Resend: from="${fromAddress}" to="${toAddress}" subject="${subject}"`)

  let resendRes: Response
  let resendBody: string
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload),
    })
    resendBody = await resendRes.text()
    console.log(`[send-email] Resend response: status=${resendRes.status} ok=${resendRes.ok} body=${resendBody}`)
  } catch (fetchErr) {
    console.error(`[send-email] Resend fetch error: ${fetchErr instanceof Error ? fetchErr.stack : String(fetchErr)}`)
    return json({ ok: false, error: 'Network error reaching Resend.' })
  }

  if (!resendRes.ok) {
    let errMsg: string
    try { errMsg = (JSON.parse(resendBody) as { message?: string }).message ?? `Resend error ${resendRes.status}` }
    catch { errMsg = `Resend error ${resendRes.status}` }
    return json({ ok: false, error: errMsg })
  }

  let providerMessageId: string | null = null
  try { providerMessageId = (JSON.parse(resendBody) as { id?: string }).id ?? null }
  catch { /* keep null */ }
  console.log(`[send-email] Resend accepted. message_id=${providerMessageId}`)

  // ── Save to email_messages ────────────────────────────────
  const { error: dbErr } = await db.from('email_messages').insert({
    agency_id,
    client_id:           client_id  ?? null,
    contact_id:          contact_id ?? null,
    to_email,
    to_name:             to_name    ?? null,
    from_email:          sharedFromEmail,
    from_name:           senderName,
    subject,
    body_html:           body_html  ?? null,
    body_text:           body_text  ?? null,
    provider_message_id: providerMessageId,
    status:              'sent',
    created_by:          user.id,
  })
  console.log(`[send-email] email_messages insert: ${dbErr ? `FAILED: ${dbErr.message}` : 'ok'}`)

  return json({ ok: true, message_id: providerMessageId })
})
