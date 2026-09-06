import { supabase } from '@/lib/supabase'
import type {
  Website, Domain, SocialChannel, SocialChannelSnapshot,
  BusinessListing, SeoProfile, TrackingConfiguration, DigitalAsset,
} from '@/types'

// Every fetcher here follows the existing Business Workspace convention
// (see features/billing/api.ts, features/clients/api.ts): log-and-throw on
// a real query error so callers using Promise.allSettled can distinguish a
// failed source (→ 'unknown' in the UI) from a genuinely empty one
// (→ 'empty'), instead of silently collapsing both into zero.

export async function listWebsites(clientId: string): Promise<Website[]> {
  const { data, error } = await supabase
    .from('websites').select('*').eq('client_id', clientId)
    .order('is_primary', { ascending: false }).order('created_at', { ascending: true })
  if (error) { console.error('listWebsites:', error.message); throw new Error(error.message) }
  return (data ?? []) as Website[]
}

export async function listDomains(clientId: string): Promise<Domain[]> {
  const { data, error } = await supabase
    .from('domains').select('*').eq('client_id', clientId)
    .order('expiration_date', { ascending: true, nullsFirst: false })
  if (error) { console.error('listDomains:', error.message); throw new Error(error.message) }
  return (data ?? []) as Domain[]
}

export async function listSocialChannels(clientId: string): Promise<SocialChannel[]> {
  const { data, error } = await supabase
    .from('social_channels').select('*').eq('client_id', clientId)
    .order('is_active', { ascending: false }).order('created_at', { ascending: true })
  if (error) { console.error('listSocialChannels:', error.message); throw new Error(error.message) }
  return (data ?? []) as SocialChannel[]
}

export async function listRecentSocialSnapshots(clientId: string, limit = 20): Promise<SocialChannelSnapshot[]> {
  const { data, error } = await supabase
    .from('social_channel_snapshots').select('*').eq('client_id', clientId)
    .order('snapshot_date', { ascending: false }).limit(limit)
  if (error) { console.error('listRecentSocialSnapshots:', error.message); throw new Error(error.message) }
  return (data ?? []) as SocialChannelSnapshot[]
}

export async function listBusinessListings(clientId: string): Promise<BusinessListing[]> {
  const { data, error } = await supabase
    .from('business_listings').select('*').eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) { console.error('listBusinessListings:', error.message); throw new Error(error.message) }
  return (data ?? []) as BusinessListing[]
}

/** One row per client at most — see seo_profiles_one_per_client. */
export async function getSeoProfile(clientId: string): Promise<SeoProfile | null> {
  const { data, error } = await supabase
    .from('seo_profiles').select('*').eq('client_id', clientId).maybeSingle()
  if (error) { console.error('getSeoProfile:', error.message); throw new Error(error.message) }
  return data as SeoProfile | null
}

export async function listTrackingConfigurations(clientId: string): Promise<TrackingConfiguration[]> {
  const { data, error } = await supabase
    .from('tracking_configurations').select('*').eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) { console.error('listTrackingConfigurations:', error.message); throw new Error(error.message) }
  return (data ?? []) as TrackingConfiguration[]
}

export async function listDigitalAssets(clientId: string): Promise<DigitalAsset[]> {
  const { data, error } = await supabase
    .from('digital_assets').select('*').eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) { console.error('listDigitalAssets:', error.message); throw new Error(error.message) }
  return (data ?? []) as DigitalAsset[]
}

/**
 * The only supported way to change which website is primary — see
 * sql/wave-digital-workspace/wave-1-foundation/05-rpcs.sql. Never flip
 * is_primary with a plain update from the frontend.
 */
export async function setPrimaryWebsite(websiteId: string, actorId: string): Promise<Website> {
  const { data, error } = await supabase.rpc('set_primary_website', {
    p_website_id: websiteId,
    p_actor_id: actorId,
  })
  if (error) { console.error('setPrimaryWebsite:', error.message); throw new Error(error.message) }
  return data as Website
}
