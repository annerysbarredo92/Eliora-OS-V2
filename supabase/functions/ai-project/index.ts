import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apiKey      = Deno.env.get('ANTHROPIC_API_KEY')!

    // Verify caller JWT and get their profile
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { project_id, query } = await req.json()
    if (!project_id || !query) return json({ error: 'project_id and query are required' }, 400)

    // Use service role to fetch all project data (bypass RLS for internal AI use)
    const admin = createClient(supabaseUrl, serviceKey)

    // Verify the user has access to this project
    const { data: profile } = await admin.from('profiles').select('agency_id, role').eq('id', user.id).single()
    if (!profile?.agency_id) return json({ error: 'Profile not found' }, 403)

    const { data: project } = await admin.from('clients')
      .select('*, client_contacts(*), pipeline_stages!clients_stage_id_fkey(*)')
      .eq('id', project_id)
      .eq('agency_id', profile.agency_id)
      .single()
    if (!project) return json({ error: 'Project not found or access denied' }, 404)

    // Fetch supporting data in parallel
    const [proposalsRes, contentRes, messagesRes, activityRes, invoicesRes] = await Promise.all([
      admin.from('proposals').select('title, status, total_cents, expires_at, sent_at, decided_at').eq('client_id', project_id).order('created_at', { ascending: false }).limit(10),
      admin.from('content_items').select('title, status, platform, caption, scheduled_date').eq('client_id', project_id).order('created_at', { ascending: false }).limit(20),
      admin.from('messages').select('body, kind, author_role, created_at').eq('client_id', project_id).eq('is_client_visible', true).order('created_at', { ascending: false }).limit(15),
      admin.from('activity_log').select('action, description, created_at').eq('client_id', project_id).order('created_at', { ascending: false }).limit(20),
      admin.from('invoices').select('title, status, total_cents, due_date').eq('client_id', project_id).order('created_at', { ascending: false }).limit(5),
    ])

    const pc = project.client_contacts?.find((c: Record<string, unknown>) => c.is_primary) ?? project.client_contacts?.[0]
    const stage = project.pipeline_stages

    // Build the AI context prompt
    const context = `
PROJECT CONTEXT FOR: ${project.business_name}
═══════════════════════════════════════════

CURRENT STAGE: ${stage?.name ?? 'Unknown'}
STATUS: ${project.status}
HEALTH: ${project.health}
PROJECT VALUE: $${((project.project_value_cents ?? 0) / 100).toLocaleString()}
CLOSE PROBABILITY: ${project.close_probability ?? '—'}%
LEAD SCORE: ${project.lead_score ?? '—'}/100

BUSINESS INFO:
- Industry: ${project.industry ?? '—'}
- Website: ${project.website ?? '—'}
- Location: ${project.location ?? '—'}
- Phone: ${project.business_phone ?? '—'}

PRIMARY CONTACT:
- Name: ${pc ? `${pc.first_name} ${pc.last_name ?? ''}`.trim() : '—'}
- Email: ${pc?.email ?? '—'}
- Phone: ${pc?.phone ?? '—'}
- Title: ${pc?.title ?? '—'}

SALES DETAILS:
- Lead Source: ${project.lead_source ?? '—'}
- Decision Maker: ${project.decision_maker ?? '—'}
- Estimated Budget: $${((project.estimated_budget_cents ?? 0) / 100).toLocaleString()}
- Expected Close: ${project.expected_close_date ?? '—'}
- Next Follow-Up: ${project.next_follow_up_at ?? '—'}
- Next Action: ${project.next_action ?? '—'}

LEAD INFORMATION:
${JSON.stringify(project.lead_info ?? {}, null, 2)}

DISCOVERY DATA:
${JSON.stringify(project.discovery_data ?? {}, null, 2)}

PROPOSALS (${proposalsRes.data?.length ?? 0}):
${(proposalsRes.data ?? []).map((p: Record<string, unknown>) => `- ${p.title} | $${((p.total_cents as number ?? 0) / 100).toLocaleString()} | ${p.status} | Sent: ${p.sent_at ?? '—'} | Decided: ${p.decided_at ?? '—'}`).join('\n') || 'None'}

CONTENT (${contentRes.data?.length ?? 0} recent items):
${(contentRes.data ?? []).map((c: Record<string, unknown>) => `- [${c.platform}] ${c.title} | ${c.status} | Scheduled: ${c.scheduled_date ?? 'TBD'}`).join('\n') || 'None'}

RECENT MESSAGES (${messagesRes.data?.length ?? 0}):
${(messagesRes.data ?? []).map((m: Record<string, unknown>) => `- [${m.author_role}] ${String(m.body).slice(0, 120)} (${m.created_at})`).join('\n') || 'None'}

INVOICES:
${(invoicesRes.data ?? []).map((i: Record<string, unknown>) => `- ${i.title ?? 'Invoice'} | $${((i.total_cents as number ?? 0) / 100).toLocaleString()} | ${i.status} | Due: ${i.due_date ?? '—'}`).join('\n') || 'None'}

RECENT ACTIVITY:
${(activityRes.data ?? []).map((a: Record<string, unknown>) => `- ${a.action}: ${a.description} (${a.created_at})`).join('\n') || 'None'}
`.trim()

    // Call Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        system: `You are the AI assistant for ${project.business_name}'s account at a marketing agency. You have access to complete, real-time project data. Answer questions accurately based on the provided context. Be concise, actionable, and specific. Format responses clearly with bullet points or sections where helpful.`,
        messages: [
          { role: 'user', content: `${context}\n\n---\n\nUser query: ${query}` },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      console.error('Anthropic error:', err)
      return json({ error: 'AI service error. Please try again.' }, 502)
    }

    const aiData = await anthropicRes.json()
    const answer = aiData.content?.[0]?.text ?? 'No response from AI.'

    return json({ answer, project_name: project.business_name })

  } catch (err) {
    console.error('ai-project error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
