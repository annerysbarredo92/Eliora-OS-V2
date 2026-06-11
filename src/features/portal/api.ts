import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import { ONBOARDING_SECTIONS, pctFromSections } from './helpers'
import type {
  ClientPortalProfile, ClientPortalSettings, ClientOnboardingProgress, Agency,
} from '@/types'
import type { SectionKey } from './helpers'

export interface PortalCtx {
  agencyId: string
  clientId: string
  actorId: string
}

/* ── Bootstrap + reads ───────────────────────────────────── */

export async function ensurePortal(clientId: string): Promise<void> {
  const { error } = await supabase.rpc('ensure_client_portal', { _client_id: clientId })
  if (error) console.error('ensure_client_portal failed:', error.message)
}

/** Agency-side: provision portal rows for a client and mark the client portal-enabled. */
export async function enablePortal(clientId: string, ctx: { agencyId: string; actorId: string }): Promise<void> {
  await ensurePortal(clientId)
  const { error } = await supabase.from('clients').update({ portal_enabled: true, updated_by: ctx.actorId }).eq('id', clientId)
  if (error) { console.error('enablePortal failed:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'client.portal_enabled', entityType: 'client', entityId: clientId,
    description: 'Enabled the client portal',
  })
}

export async function getClientProfile(clientId: string): Promise<ClientPortalProfile | null> {
  const { data, error } = await supabase.from('client_profiles').select('*').eq('client_id', clientId).maybeSingle()
  if (error) { console.error('getClientProfile failed:', error.message); return null }
  return (data as ClientPortalProfile) ?? null
}

export async function getPortalSettings(clientId: string): Promise<ClientPortalSettings | null> {
  const { data, error } = await supabase.from('client_portal_settings').select('*').eq('client_id', clientId).maybeSingle()
  if (error) { console.error('getPortalSettings failed:', error.message); return null }
  return (data as ClientPortalSettings) ?? null
}

export async function getOnboarding(clientId: string): Promise<ClientOnboardingProgress | null> {
  const { data, error } = await supabase.from('client_onboarding_progress').select('*').eq('client_id', clientId).maybeSingle()
  if (error) { console.error('getOnboarding failed:', error.message); return null }
  return (data as ClientOnboardingProgress) ?? null
}

export async function getAgency(agencyId: string): Promise<Agency | null> {
  const { data, error } = await supabase.from('agencies').select('*').eq('id', agencyId).maybeSingle()
  if (error) { console.error('getAgency failed:', error.message); return null }
  return (data as Agency) ?? null
}

/* ── Writes ──────────────────────────────────────────────── */

/** Patch the client_profiles row for this client. */
export async function saveClientProfile(patch: Partial<ClientPortalProfile>, ctx: PortalCtx): Promise<void> {
  const { error } = await supabase
    .from('client_profiles')
    .update({ ...patch, updated_by: ctx.actorId })
    .eq('client_id', ctx.clientId)
  if (error) { console.error('saveClientProfile failed:', error.message); throw new Error(error.message) }
}

/** Patch the client_portal_settings row for this client. */
export async function savePortalSettings(patch: Partial<ClientPortalSettings>, ctx: PortalCtx): Promise<void> {
  const { error } = await supabase
    .from('client_portal_settings')
    .update({ ...patch, updated_by: ctx.actorId })
    .eq('client_id', ctx.clientId)
  if (error) { console.error('savePortalSettings failed:', error.message); throw new Error(error.message) }
}

/**
 * Save one onboarding section: writes the section's fields (to client_profiles
 * and/or client_portal_settings), marks the section complete, and recomputes %.
 */
export async function saveOnboardingSection(
  key: SectionKey,
  data: { profile?: Partial<ClientPortalProfile>; settings?: Partial<ClientPortalSettings> },
  current: ClientOnboardingProgress | null,
  ctx: PortalCtx,
): Promise<void> {
  if (data.profile) await saveClientProfile(data.profile, ctx)
  if (data.settings) await savePortalSettings(data.settings, ctx)

  const sections = { ...(current?.sections ?? {}), [key]: true }
  const pct = pctFromSections(sections)
  const allDone = pct >= 100

  const { error } = await supabase
    .from('client_onboarding_progress')
    .update({ sections, completion_pct: pct, completed_at: allDone ? new Date().toISOString() : null })
    .eq('client_id', ctx.clientId)
  if (error) { console.error('saveOnboardingSection failed:', error.message); throw new Error(error.message) }

  const label = ONBOARDING_SECTIONS.find(s => s.key === key)?.label ?? key
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: 'client.onboarding_section', entityType: 'client_onboarding',
    description: `Completed onboarding section: ${label}`,
  })
  if (allDone) {
    await logActivity({
      agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
      action: 'client.onboarding_completed', entityType: 'client_onboarding',
      description: 'Completed client onboarding',
    })
  }
}

/** Settings page save — profile contact fields + portal settings. */
export async function saveSettings(
  data: { profile?: Partial<ClientPortalProfile>; settings?: Partial<ClientPortalSettings> },
  ctx: PortalCtx,
): Promise<void> {
  if (data.profile) await saveClientProfile(data.profile, ctx)
  if (data.settings) await savePortalSettings(data.settings, ctx)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: 'client.settings_updated', entityType: 'client_settings',
    description: 'Updated portal settings',
  })
}
