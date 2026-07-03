import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { AiResult, AiGeneration, AiPromptTemplate, AiSavedOutput } from '@/types'

export interface Brief {
  business_type?: string; service_product?: string; target_audience?: string; pain_point?: string
  offer?: string; goal?: string; platform?: string; content_type?: string; tone?: string
  cta?: string; campaign_goal?: string; notes?: string
}
interface Ctx { agencyId: string; actorId: string; clientId?: string | null }

const EMPTY: AiResult = { captions: [], hooks: [], hashtags: [], ideas: [], creative_direction: '', visual_suggestions: [] }

export interface GenerateOutcome { result: AiResult; notConfigured: boolean; error?: string; model?: string }

/** Calls the ai-generate Edge Function (server-side key), then logs the generation. */
export async function generate(brief: Brief | Record<string, unknown>, count: number, kind: string, ctx: Ctx): Promise<GenerateOutcome> {
  const { data, error } = await supabase.functions.invoke('ai-generate', { body: { brief, count, kind } })
  if (error) return { result: EMPTY, notConfigured: false, error: error.message }
  if (data?.not_configured) return { result: EMPTY, notConfigured: true }
  if (data?.error) return { result: EMPTY, notConfigured: false, error: data.error }

  const result: AiResult = { ...EMPTY, ...(data?.result ?? {}) }
  // Log generation + AI history (RLS: actor_id = auth.uid()).
  await supabase.from('ai_generations').insert({
    agency_id: ctx.agencyId, actor_id: ctx.actorId, client_id: ctx.clientId ?? null, kind,
    model: data?.model ?? null, brief, result,
  })
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId ?? null, action: 'ai.generated', entityType: 'ai_generation', description: `AI generated ${kind}` })
  return { result, notConfigured: false, model: data?.model }
}

export async function listGenerations(): Promise<AiGeneration[]> {
  const { data, error } = await supabase.from('ai_generations').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) { console.error('listGenerations:', error.message); return [] }
  return (data ?? []) as AiGeneration[]
}

/** Returns today's daily brief generation, or null if one hasn't been generated yet. */
export async function getTodaysBrief(): Promise<AiGeneration | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ai_generations')
    .select('*')
    .eq('kind', 'daily_brief')
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lt('created_at', `${today}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as AiGeneration) ?? null
}
export async function listPromptTemplates(): Promise<AiPromptTemplate[]> {
  const { data } = await supabase.from('ai_prompt_templates').select('*').order('created_at', { ascending: false })
  return (data ?? []) as AiPromptTemplate[]
}
export async function savePromptTemplate(name: string, template: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('ai_prompt_templates').insert({ agency_id: ctx.agencyId, name: name.trim(), template, created_by: ctx.actorId })
  if (error) throw new Error(error.message)
}
export async function listSavedOutputs(): Promise<AiSavedOutput[]> {
  const { data } = await supabase.from('ai_saved_outputs').select('*').order('created_at', { ascending: false }).limit(50)
  return (data ?? []) as AiSavedOutput[]
}
export async function saveOutput(title: string, content: Record<string, unknown>, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('ai_saved_outputs').insert({ agency_id: ctx.agencyId, title: title.trim(), content, created_by: ctx.actorId })
  if (error) throw new Error(error.message)
}

export const BRIEF_FIELDS: { key: keyof Brief; label: string }[] = [
  { key: 'business_type', label: 'Business Type' }, { key: 'service_product', label: 'Service / Product' },
  { key: 'target_audience', label: 'Target Audience' }, { key: 'pain_point', label: 'Pain Point' },
  { key: 'offer', label: 'Offer' }, { key: 'goal', label: 'Goal' }, { key: 'platform', label: 'Platform' },
  { key: 'content_type', label: 'Content Type' }, { key: 'tone', label: 'Tone' }, { key: 'cta', label: 'CTA' },
  { key: 'campaign_goal', label: 'Campaign Goal' }, { key: 'notes', label: 'Notes' },
]
export const BATCH_OPTIONS = [
  { value: 1, label: 'Single Post' }, { value: 5, label: '5 Posts' }, { value: 10, label: '10 Posts' },
  { value: 30, label: '30-Day Plan' }, { value: 12, label: 'Campaign Series' },
]
