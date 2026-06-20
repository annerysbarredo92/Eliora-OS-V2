// Eliora OS — AI generation Edge Function (Deno / Supabase Functions).
// The provider API key is read from a Supabase secret (ANTHROPIC_API_KEY) and is
// NEVER exposed to the browser. Deploy: `supabase functions deploy ai-generate`.
// Set secret:   `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
//
// Request body: { brief: {...}, kind?: 'content'|'batch', count?: number }
// Response:     { captions, hooks, hashtags, ideas, creative_direction, visual_suggestions }
//           or  { not_configured: true } when no key is set.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-sonnet-4-6'

function buildPrompt(brief: Record<string, unknown>, count: number): string {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ not_configured: true, message: 'AI provider key not set. Run: supabase secrets set ANTHROPIC_API_KEY=...' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })
  }

  try {
    const { brief = {}, count = 1 } = await req.json().catch(() => ({}))
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1500,
        messages: [{ role: 'user', content: buildPrompt(brief, count) }],
      }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      return new Response(JSON.stringify({ error: `provider ${resp.status}`, detail: errText.slice(0, 300) }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
      })
    }
    const data = await resp.json()
    const text: string = data?.content?.[0]?.text ?? '{}'
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = { captions: [text], hooks: [], hashtags: [], ideas: [], creative_direction: '', visual_suggestions: [] } }
    return new Response(JSON.stringify({ result: parsed, model: MODEL }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200,
    })
  }
})
