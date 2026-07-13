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

    // Fetch supporting data in parallel — Wave 3 data + operational data
    const [
      proposalsRes, contentRes, messagesRes, activityRes, invoicesRes,
      productsRes, goalsRes, kpisRes, competitorsRes, retainersRes,
    ] = await Promise.all([
      admin.from('proposals').select('title, status, total_cents, expires_at, sent_at, decided_at').eq('client_id', project_id).neq('status', 'draft').order('created_at', { ascending: false }).limit(10),
      admin.from('content_items').select('title, status, platform, caption, scheduled_date').eq('client_id', project_id).order('created_at', { ascending: false }).limit(20),
      admin.from('messages').select('body, kind, author_role, created_at').eq('client_id', project_id).eq('is_client_visible', true).order('created_at', { ascending: false }).limit(15),
      admin.from('activity_log').select('action, description, created_at').eq('client_id', project_id).order('created_at', { ascending: false }).limit(20),
      admin.from('invoices').select('title, status, total_cents, amount_paid_cents, due_date').eq('client_id', project_id).neq('status', 'void').neq('status', 'archived').order('created_at', { ascending: false }).limit(10),
      admin.from('client_products_services').select('name, type, description, target_audience, benefits, pricing_type, price_cents, price_min_cents, price_max_cents, price_label, status, include_in_ai_context').eq('client_id', project_id).eq('status', 'active').eq('include_in_ai_context', true).order('sort_order'),
      admin.from('goals').select('title, description, status, current_value, target_value, due_date, time_period, owner').eq('client_id', project_id).eq('is_archived', false).order('created_at', { ascending: false }).limit(15),
      admin.from('kpis').select('name, description, metric_key, current_value, target_value, unit, period, status').eq('client_id', project_id).eq('is_archived', false).order('created_at', { ascending: false }).limit(20),
      admin.from('client_competitors').select('name, website, description, strengths, weaknesses').eq('client_id', project_id).order('created_at', { ascending: false }).limit(10),
      admin.from('retainers').select('title, status, frequency, amount_cents, start_date, next_billing_date').eq('client_id', project_id).neq('status', 'ended').order('created_at', { ascending: false }).limit(5),
    ])

    const pc = project.client_contacts?.find((c: Record<string, unknown>) => c.is_primary) ?? project.client_contacts?.[0]
    const stage = project.pipeline_stages
    const dd = (project.discovery_data ?? {}) as Record<string, unknown>

    // Wave 3 structured domain extraction
    const brandVoice    = (dd.brand_voice ?? {}) as Record<string, unknown>
    const brandStrategy = (dd.brand_strategy ?? {}) as Record<string, unknown>
    const discBiz       = (dd.discovery_business ?? {}) as Record<string, unknown>
    const discAud       = (dd.discovery_audience ?? {}) as Record<string, unknown>
    const discMkt       = (dd.discovery_marketing ?? {}) as Record<string, unknown>
    const aiSummary     = (dd.discovery_ai_summary ?? {}) as Record<string, unknown>
    const swot          = (dd.market_swot ?? {}) as Record<string, unknown>
    const position      = (dd.market_position ?? {}) as Record<string, unknown>

    function fmtPrice(r: Record<string, unknown>): string {
      if (r.price_label) return r.price_label as string
      if (r.pricing_type === 'free') return 'Free'
      if (r.pricing_type === 'custom') return 'Contact for pricing'
      const c = (v: unknown) => typeof v === 'number' ? `$${(v / 100).toLocaleString()}` : ''
      if (r.pricing_type === 'range') return `${c(r.price_min_cents)} – ${c(r.price_max_cents)}`
      if (r.pricing_type === 'starting_at') return `Starting at ${c(r.price_min_cents)}`
      return c(r.price_cents) || '—'
    }

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

━━━ BRAND & STRATEGY ━━━
Voice: ${brandVoice.voice_descriptor ?? '—'}
Tone Guidelines: ${brandVoice.tone_guidelines ?? '—'}
Mission: ${brandStrategy.mission ?? '—'}
Vision: ${brandStrategy.vision ?? '—'}
Positioning: ${brandStrategy.positioning ?? '—'}
UVP: ${brandStrategy.uvp ?? '—'}
Values: ${Array.isArray(brandStrategy.values) ? (brandStrategy.values as string[]).join(', ') : '—'}
Taglines: ${Array.isArray(brandStrategy.taglines) ? (brandStrategy.taglines as string[]).join(' | ') : '—'}
Keywords: ${Array.isArray(brandStrategy.keywords) ? (brandStrategy.keywords as string[]).join(', ') : '—'}

━━━ DISCOVERY ━━━
AI Summary: ${aiSummary.summary ?? '(not generated yet)'}

Business Challenges: ${discBiz.challenges ?? '—'}
Business Priorities: ${discBiz.priorities ?? '—'}
Business Model: ${discBiz.business_model ?? '—'}
Revenue Model: ${discBiz.revenue_model ?? '—'}
Service Area: ${discBiz.service_area ?? '—'}
Customer Journey: ${discBiz.customer_journey ?? '—'}

Primary Audience: ${discAud.primary_audience ?? '—'}
Demographics: ${discAud.demographics ?? '—'}
Pain Points: ${discAud.pain_points ?? '—'}
Motivations: ${discAud.motivations ?? '—'}
Buying Triggers: ${discAud.buying_triggers ?? '—'}

Current Marketing Channels: ${discMkt.current_channels ?? '—'}
Past Performance: ${discMkt.past_performance ?? '—'}
Current Campaigns: ${discMkt.current_campaigns ?? '—'}
Content Maturity: ${discMkt.content_maturity ?? '—'}
SEO Maturity: ${discMkt.seo_maturity ?? '—'}

━━━ PRODUCTS & SERVICES (${productsRes.data?.length ?? 0} in AI context) ━━━
${(productsRes.data ?? []).map((p: Record<string, unknown>) =>
  `- [${p.type}] ${p.name} | ${fmtPrice(p)} | ${p.status}\n  ${p.description ?? ''}\n  Audience: ${p.target_audience ?? '—'}\n  Benefits: ${Array.isArray(p.benefits) ? (p.benefits as string[]).join(', ') : '—'}`
).join('\n') || 'None added'}

━━━ GOALS & KPIS ━━━
GOALS (${goalsRes.data?.length ?? 0} active):
${(goalsRes.data ?? []).map((g: Record<string, unknown>) => {
  const pct = g.target_value ? Math.round(((g.current_value as number) / (g.target_value as number)) * 100) : 0
  return `- ${g.title} | ${g.status} | Progress: ${g.current_value}/${g.target_value} (${pct}%) | Due: ${g.due_date ?? '—'} | ${g.time_period ?? ''}`
}).join('\n') || 'None set'}

KPIS (${kpisRes.data?.length ?? 0} active):
${(kpisRes.data ?? []).map((k: Record<string, unknown>) => {
  const pct = k.target_value ? Math.round(((k.current_value as number) / (k.target_value as number)) * 100) : 0
  return `- ${k.name} | ${k.status} | ${k.current_value}${k.unit ?? ''} / ${k.target_value}${k.unit ?? ''} (${pct}%) | ${k.period ?? '—'}`
}).join('\n') || 'None set'}

━━━ MARKET INTELLIGENCE ━━━
COMPETITORS (${competitorsRes.data?.length ?? 0}):
${(competitorsRes.data ?? []).map((c: Record<string, unknown>) =>
  `- ${c.name}${c.website ? ` (${c.website})` : ''}: ${c.description ?? ''}\n  Strengths: ${Array.isArray(c.strengths) ? (c.strengths as string[]).join(', ') : '—'}\n  Weaknesses: ${Array.isArray(c.weaknesses) ? (c.weaknesses as string[]).join(', ') : '—'}`
).join('\n') || 'None added'}

SWOT:
- Strengths: ${Array.isArray(swot.strengths) ? (swot.strengths as string[]).join('; ') : '—'}
- Weaknesses: ${Array.isArray(swot.weaknesses) ? (swot.weaknesses as string[]).join('; ') : '—'}
- Opportunities: ${Array.isArray(swot.opportunities) ? (swot.opportunities as string[]).join('; ') : '—'}
- Threats: ${Array.isArray(swot.threats) ? (swot.threats as string[]).join('; ') : '—'}

Market Position: ${position.statement ?? '—'}
Target Segment: ${position.target_segment ?? '—'}
Differentiators: ${Array.isArray(position.differentiators) ? (position.differentiators as string[]).join(', ') : '—'}

━━━ OPERATIONAL ━━━
PROPOSALS (${proposalsRes.data?.length ?? 0}):
${(proposalsRes.data ?? []).map((p: Record<string, unknown>) => `- ${p.title} | $${((p.total_cents as number ?? 0) / 100).toLocaleString()} | ${p.status} | Sent: ${p.sent_at ?? '—'} | Decided: ${p.decided_at ?? '—'}`).join('\n') || 'None'}

CONTENT (${contentRes.data?.length ?? 0} recent items):
${(contentRes.data ?? []).map((c: Record<string, unknown>) => `- [${c.platform}] ${c.title} | ${c.status} | Scheduled: ${c.scheduled_date ?? 'TBD'}`).join('\n') || 'None'}

RECENT MESSAGES (${messagesRes.data?.length ?? 0}):
${(messagesRes.data ?? []).map((m: Record<string, unknown>) => `- [${m.author_role}] ${String(m.body).slice(0, 120)} (${m.created_at})`).join('\n') || 'None'}

INVOICES:
${(invoicesRes.data ?? []).map((i: Record<string, unknown>) => `- ${i.title ?? 'Invoice'} | $${((i.total_cents as number ?? 0) / 100).toLocaleString()} | Paid: $${((i.amount_paid_cents as number ?? 0) / 100).toLocaleString()} | ${i.status} | Due: ${i.due_date ?? '—'}`).join('\n') || 'None'}

CURRENT RETAINERS — draft/active/paused/ending (${retainersRes.data?.length ?? 0}):
${(retainersRes.data ?? []).map((r: Record<string, unknown>) => `- ${r.title} | $${((r.amount_cents as number ?? 0) / 100).toLocaleString()}/${r.frequency} | ${r.status} | Start: ${r.start_date ?? '—'} | Next billing: ${r.next_billing_date ?? '—'}`).join('\n') || 'None (ended retainers excluded from context)'}

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
