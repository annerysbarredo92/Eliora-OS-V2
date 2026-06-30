import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import { computeProgress, allRequiredAnswered } from './helpers'
import type {
  OnboardingTemplate, OnboardingSection, OnboardingProgress,
  OnboardingRequiredItem, OnboardingActivity,
} from '@/types'

export interface OnboardCtx {
  agencyId: string
  clientId: string
  actorId: string
  templateId: string | null
}

/* ── Bootstrap ───────────────────────────────────────────── */

export async function ensureOnboarding(clientId: string): Promise<void> {
  const { error } = await supabase.rpc('ensure_client_onboarding', { _client_id: clientId })
  if (error) console.error('ensure_client_onboarding failed:', error.message)
}

export async function seedTemplate(agencyId: string): Promise<void> {
  const { error } = await supabase.rpc('seed_onboarding_template', { _agency_id: agencyId })
  if (error) console.error('seed_onboarding_template failed:', error.message)
}

/* ── Reads ───────────────────────────────────────────────── */

/** Default template assembled with its sections + questions, all sorted. */
export async function getTemplate(): Promise<OnboardingTemplate | null> {
  const { data: tpl, error } = await supabase
    .from('onboarding_templates').select('*').eq('is_default', true).maybeSingle()
  if (error || !tpl) { if (error) console.error('getTemplate failed:', error.message); return null }

  const [{ data: sections }, { data: questions }] = await Promise.all([
    supabase.from('onboarding_sections').select('*').eq('template_id', tpl.id).order('sort_order'),
    supabase.from('onboarding_questions').select('*').eq('template_id', tpl.id).order('sort_order'),
  ])

  const assembled: OnboardingSection[] = (sections ?? []).map(s => ({
    ...s,
    questions: (questions ?? []).filter(q => q.section_id === s.id) as OnboardingSection['questions'],
  })) as OnboardingSection[]

  return { ...tpl, sections: assembled } as OnboardingTemplate
}

export async function getResponses(clientId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('onboarding_responses').select('question_id, value').eq('client_id', clientId)
  if (error) { console.error('getResponses failed:', error.message); return {} }
  const map: Record<string, unknown> = {}
  for (const r of data ?? []) map[r.question_id] = r.value
  return map
}

export async function getProgress(clientId: string): Promise<OnboardingProgress | null> {
  const { data, error } = await supabase.from('onboarding_progress').select('*').eq('client_id', clientId).maybeSingle()
  if (error) { console.error('getProgress failed:', error.message); return null }
  return (data as OnboardingProgress) ?? null
}

export async function getRequiredItems(clientId: string): Promise<OnboardingRequiredItem[]> {
  const { data, error } = await supabase.from('onboarding_required_items').select('*').eq('client_id', clientId).order('sort_order')
  if (error) { console.error('getRequiredItems failed:', error.message); return [] }
  return (data ?? []) as OnboardingRequiredItem[]
}

export async function getOnboardingActivity(clientId: string): Promise<OnboardingActivity[]> {
  const { data, error } = await supabase.from('onboarding_activity').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50)
  if (error) { console.error('getOnboardingActivity failed:', error.message); return [] }
  return (data ?? []) as OnboardingActivity[]
}

/* ── Writes ──────────────────────────────────────────────── */

async function logOnboarding(ctx: OnboardCtx, action: string, description: string) {
  const { error } = await supabase.from('onboarding_activity').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId, actor_profile_id: ctx.actorId, action, description,
  })
  if (error) console.error('logOnboarding failed:', error.message)
}

async function writeProgress(
  ctx: OnboardCtx, template: OnboardingTemplate, mergedResponses: Record<string, unknown>,
  requiredItems: OnboardingRequiredItem[], savedSections: Record<string, boolean>, submitting = false,
) {
  const c = computeProgress(template, mergedResponses, requiredItems, savedSections, submitting)
  const patch: Record<string, unknown> = {
    template_id: template.id, sections: c.sections, completion_pct: c.completion_pct,
    total_sections: c.total_sections, completed_sections: c.completed_sections,
    missing_items: c.missing_items, status: c.status, last_saved_at: new Date().toISOString(),
  }
  if (submitting) patch.submitted_at = new Date().toISOString()
  const { error } = await supabase.from('onboarding_progress').update(patch).eq('client_id', ctx.clientId)
  if (error) { console.error('writeProgress failed:', error.message); throw new Error(error.message) }
  return c
}

/** Save one section's answers, recompute progress, log activity. */
export async function saveSection(
  section: OnboardingSection,
  answers: Record<string, unknown>,       // question_id -> value (this section only)
  template: OnboardingTemplate,
  progress: OnboardingProgress | null,
  requiredItems: OnboardingRequiredItem[],
  ctx: OnboardCtx,
): Promise<void> {
  // 1. upsert this section's responses
  const rows = Object.entries(answers).map(([question_id, value]) => ({
    agency_id: ctx.agencyId, client_id: ctx.clientId, template_id: template.id,
    question_id, value: value ?? null, created_by: ctx.actorId, updated_by: ctx.actorId,
  }))
  if (rows.length) {
    const { error } = await supabase.from('onboarding_responses').upsert(rows, { onConflict: 'client_id,question_id' })
    if (error) { console.error('saveSection responses failed:', error.message); throw new Error(error.message) }
  }

  // 2. merge responses + section completion
  const merged = { ...(await getResponses(ctx.clientId)) }
  const completed = allRequiredAnswered(section, merged)
  const savedSections = { ...(progress?.sections ?? {}), [section.key]: completed }

  // 3. recompute + persist
  await writeProgress(ctx, template, merged, requiredItems, savedSections)

  // 4. activity
  await logOnboarding(ctx, completed ? 'section_completed' : 'section_saved', `${completed ? 'Completed' : 'Saved'} section: ${section.title}`)
  if (!progress || progress.status === 'not_started') {
    await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'onboarding.started', entityType: 'onboarding', description: 'Started onboarding' })
  }
}

/** Toggle a required asset item provided/not, recompute missing items. */
export async function setRequiredItem(
  item: OnboardingRequiredItem, provided: boolean,
  template: OnboardingTemplate, progress: OnboardingProgress | null,
  requiredItems: OnboardingRequiredItem[], ctx: OnboardCtx,
): Promise<void> {
  const { error } = await supabase.from('onboarding_required_items')
    .update({ is_provided: provided, provided_at: provided ? new Date().toISOString() : null })
    .eq('id', item.id)
  if (error) { console.error('setRequiredItem failed:', error.message); throw new Error(error.message) }

  const updatedItems = requiredItems.map(i => i.id === item.id ? { ...i, is_provided: provided } : i)
  const merged = await getResponses(ctx.clientId)
  await writeProgress(ctx, template, merged, updatedItems, progress?.sections ?? {})
}

/** Final submit. */
export async function submitOnboarding(
  template: OnboardingTemplate, progress: OnboardingProgress | null,
  requiredItems: OnboardingRequiredItem[], ctx: OnboardCtx,
): Promise<void> {
  const merged = await getResponses(ctx.clientId)
  await writeProgress(ctx, template, merged, requiredItems, progress?.sections ?? {}, true)
  await logOnboarding(ctx, 'submitted', 'Submitted onboarding')
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'onboarding.submitted', entityType: 'onboarding', description: 'Submitted onboarding' })
}

/** Agency-side: log that an agency user viewed a client's onboarding. */
export async function logAgencyViewedOnboarding(agencyId: string, actorId: string, clientId: string): Promise<void> {
  const { error } = await supabase.from('onboarding_activity').insert({
    agency_id: agencyId, client_id: clientId, actor_profile_id: actorId,
    action: 'agency_viewed', description: 'Agency viewed onboarding',
  })
  if (error) console.error('logAgencyViewedOnboarding failed:', error.message)
}
