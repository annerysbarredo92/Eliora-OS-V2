// Eliora OS — AI generation Edge Function (Deno / Supabase Functions).
// The provider API key is read from a Supabase secret (ANTHROPIC_API_KEY) and is
// NEVER exposed to the browser. Deploy: `supabase functions deploy ai-generate`.
// Set secret:   `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
//
// Request body: { brief: {...}, kind?: string, count?: number }
// Responses vary by kind:
//   content / batch → { captions, hooks, hashtags, ideas, creative_direction, visual_suggestions }
//   daily_brief     → { summary: string }
//   (any)           → { not_configured: true } when no key is set

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-sonnet-4-6'

function buildContentPrompt(brief: Record<string, unknown>, count: number): string {
  const lines = Object.entries(brief)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n')
  return [
    `You are an expert social media strategist for a premium marketing agency.`,
    `Using the brief below, produce ${count} on-brand option(s).`,
    ``,
    `BRIEF:`,
    lines || '- (no details provided)',
    ``,
    `Return ONLY valid minified JSON with this exact shape:`,
    `{"captions":[],"hooks":[],"hashtags":[],"ideas":[],"creative_direction":"","visual_suggestions":[]}`,
    `captions/hooks/ideas/hashtags/visual_suggestions are arrays of short strings; creative_direction is one paragraph.`,
  ].join('\n')
}

function buildDailyBriefPrompt(context: Record<string, unknown>): string {
  const lines = Object.entries(context)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n')
  return [
    `You are an intelligent chief of staff for a creative marketing agency.`,
    `Based on the agency data below, write a concise daily brief.`,
    ``,
    `AGENCY DATA:`,
    lines || '- (no data available)',
    ``,
    `Answer the question: "What needs my attention today?"`,
    `Identify 3-5 key observations maximum. Surface priorities, risks, and opportunities.`,
    `Suggest one or two concrete next actions.`,
    `Write in plain prose. Direct and actionable. No bullet points, no headers, no markdown.`,
    `Maximum 150 words.`,
    ``,
    `Return ONLY valid minified JSON: {"summary":"<brief text here>"}`,
  ].join('\n')
}

async function callAnthropic(key: string, prompt: string): Promise<{ text: string; error?: string }> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!resp.ok) {
    const errText = await resp.text()
    return { text: '', error: `provider ${resp.status}: ${errText.slice(0, 300)}` }
  }
  const data = await resp.json()
  return { text: data?.content?.[0]?.text ?? '{}' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) {
    return new Response(
      JSON.stringify({ not_configured: true, message: 'AI provider key not set. Run: supabase secrets set ANTHROPIC_API_KEY=...' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 },
    )
  }

  try {
    const { brief = {}, count = 1, kind = 'content' } = await req.json().catch(() => ({}))

    // ── Daily Brief ──────────────────────────────────────────────
    if (kind === 'daily_brief') {
      const { text, error } = await callAnthropic(key, buildDailyBriefPrompt(brief as Record<string, unknown>))
      if (error) return new Response(JSON.stringify({ error }), { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 })
      let parsed: { summary?: string } = {}
      try { parsed = JSON.parse(text) } catch { parsed = { summary: text } }
      return new Response(
        JSON.stringify({ result: { summary: parsed.summary ?? text }, model: MODEL }),
        { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // ── Content / Batch (default) ────────────────────────────────
    const { text, error } = await callAnthropic(key, buildContentPrompt(brief as Record<string, unknown>, count))
    if (error) return new Response(JSON.stringify({ error }), { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 })
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch {
      parsed = { captions: [text], hooks: [], hashtags: [], ideas: [], creative_direction: '', visual_suggestions: [] }
    }
    return new Response(
      JSON.stringify({ result: parsed, model: MODEL }),
      { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 })
  }
})
