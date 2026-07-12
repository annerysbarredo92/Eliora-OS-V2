import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import { updateDiscoveryData } from '@/features/clients/api'
import type { ClientCompetitor, MarketSWOT, MarketPosition } from '@/types'

interface Ctx { agencyId: string; actorId: string }

/* ── Competitors ─────────────────────────────────────────── */

export async function listCompetitors(clientId: string): Promise<ClientCompetitor[]> {
  const { data, error } = await supabase
    .from('client_competitors')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) { console.error('listCompetitors:', error.message); throw new Error(error.message) }
  return (data ?? []) as ClientCompetitor[]
}

export interface CompetitorFormValues {
  name: string
  website: string
  description: string
  social_profiles: Record<string, string>
  strengths: string[]
  weaknesses: string[]
  notes: string
}

export async function createCompetitor(clientId: string, values: CompetitorFormValues, ctx: Ctx): Promise<ClientCompetitor> {
  const { data, error } = await supabase
    .from('client_competitors')
    .insert({
      agency_id:        ctx.agencyId,
      client_id:        clientId,
      name:             values.name.trim(),
      website:          values.website.trim() || null,
      description:      values.description.trim() || null,
      social_profiles:  values.social_profiles,
      strengths:        values.strengths,
      weaknesses:       values.weaknesses,
      notes:            values.notes.trim() || null,
      created_by:       ctx.actorId,
      updated_by:       ctx.actorId,
    })
    .select('*')
    .single()
  if (error) { console.error('createCompetitor:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'competitor.created', entityType: 'competitor', entityId: data.id,
    description: `Added competitor: ${values.name.trim()}`,
  })
  return data as ClientCompetitor
}

export async function updateCompetitor(id: string, clientId: string, values: CompetitorFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('client_competitors')
    .update({
      name:             values.name.trim(),
      website:          values.website.trim() || null,
      description:      values.description.trim() || null,
      social_profiles:  values.social_profiles,
      strengths:        values.strengths,
      weaknesses:       values.weaknesses,
      notes:            values.notes.trim() || null,
      updated_by:       ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateCompetitor:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'competitor.updated', entityType: 'competitor', entityId: id,
    description: `Updated competitor: ${values.name.trim()}`,
  })
}

export async function deleteCompetitor(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('client_competitors').delete().eq('id', id)
  if (error) { console.error('deleteCompetitor:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'competitor.deleted', entityType: 'competitor',
    description: 'Deleted a competitor',
  })
}

/* ── SWOT (stored in discovery_data.market_swot) ─────────── */

export function readSWOT(discoveryData: Record<string, unknown>): MarketSWOT {
  const raw = discoveryData.market_swot as Partial<MarketSWOT> | undefined
  return {
    strengths:     Array.isArray(raw?.strengths)     ? raw.strengths     : [],
    weaknesses:    Array.isArray(raw?.weaknesses)    ? raw.weaknesses    : [],
    opportunities: Array.isArray(raw?.opportunities) ? raw.opportunities : [],
    threats:       Array.isArray(raw?.threats)       ? raw.threats       : [],
  }
}

export async function saveSWOT(clientId: string, swot: MarketSWOT, ctx: Ctx): Promise<void> {
  await updateDiscoveryData(clientId, { market_swot: swot }, ctx)
}

/* ── Market Position (stored in discovery_data.market_position) ── */

export function readMarketPosition(discoveryData: Record<string, unknown>): MarketPosition {
  const raw = discoveryData.market_position as Partial<MarketPosition> | undefined
  return {
    positioning_statement: raw?.positioning_statement ?? '',
    differentiators:       Array.isArray(raw?.differentiators) ? raw.differentiators : [],
    white_space:           Array.isArray(raw?.white_space)     ? raw.white_space     : [],
    industry_notes:        raw?.industry_notes ?? '',
  }
}

export async function saveMarketPosition(clientId: string, position: MarketPosition, ctx: Ctx): Promise<void> {
  await updateDiscoveryData(clientId, { market_position: position }, ctx)
}
