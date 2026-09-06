import { supabase } from '@/lib/supabase'
import type {
  Website, Domain, SocialChannel, SocialChannelSnapshot,
  BusinessListing, SeoProfile, TrackingConfiguration, DigitalAsset,
  WebsiteType, WebsiteStatus, DomainStatus, DomainSslStatus,
  BusinessListingProvider, ListingStatus,
  DigitalOwnershipStatus, DigitalIntegrationStatus, DigitalVerificationStatus,
} from '@/types'

interface Ctx { agencyId: string; actorId: string }

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

/* ── Mutation error parsing ────────────────────────────────
   Postgres unique-constraint and trigger-raised errors surface as raw
   messages containing the constraint/exception name — translate the ones a
   user can actually hit into plain language rather than leaking SQL. */
export function parseDigitalMutationError(msg: string): string {
  if (msg.includes('domains_client_name_idx')) return 'This domain is already on file for this client.'
  if (msg.includes('business_listings_external_id_unique_idx')) return 'A listing with this exact provider and external ID already exists for this client.'
  if (msg.includes('tracking_configurations_external_id_unique_idx')) return 'A tracking configuration with this exact provider and ID already exists for this client.'
  if (msg.includes('website_tenant_mismatch') || msg.includes('website_mismatch')) return 'That website does not belong to this client.'
  if (msg.includes('website_not_found')) return 'That website could not be found or you do not have access.'
  if (msg.includes('client_not_found')) return 'Client not found or access denied.'
  if (msg.includes('business_listings_custom_name_required')) return 'Enter a name for this custom listing provider.'
  if (msg.includes('tracking_configurations_custom_name_required')) return 'Enter a name for this custom tracking provider.'
  return msg
}

/* ── Validation ──────────────────────────────────────────── */

/** Optional-field convention throughout Digital: an empty string always
 * means "not provided", never "invalid" — required-ness is enforced per
 * field at the call site, not here. */
export function isValidUrl(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`)
    return !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}

/** Adds https:// to a bare "example.com" entry; leaves an already-schemed
 * URL untouched. Never called on an empty string (caller's job to check). */
export function normalizeUrl(value: string): string {
  const v = value.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
}

// Broad enough to accept legitimate IDN/unicode hostnames without
// converting to punycode (out of scope here) — rejects obvious garbage
// (spaces, missing TLD, stray punctuation) without an over-aggressive
// ASCII-only regex.
const DOMAIN_PATTERN = /^(?:[a-z0-9¡-￿](?:[a-z0-9¡-￿-]{0,61}[a-z0-9¡-￿])?\.)+[a-z¡-￿]{2,}$/i

/** Strips protocol/path/query/fragment and lowercases — domains.domain_name
 * stores a bare hostname, never a full URL. Does not strip a leading
 * "www." — that can be a deliberately distinct record. */
export function normalizeDomainName(value: string): string {
  let v = value.trim().toLowerCase()
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  v = v.split(/[/?#]/)[0]
  return v
}

export function isValidDomainName(value: string): boolean {
  return DOMAIN_PATTERN.test(normalizeDomainName(value))
}

/* ── Label maps — never leak a raw enum value to the UI ───── */

export const WEBSITE_TYPE_LABELS: Record<WebsiteType, string> = {
  primary_site: 'Primary site',
  ecommerce: 'Ecommerce',
  microsite: 'Microsite',
  landing_page: 'Landing page',
  secondary_brand: 'Secondary brand',
  other: 'Other',
}

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
}

export const OWNERSHIP_STATUS_LABELS: Record<DigitalOwnershipStatus, string> = {
  owned: 'Owned',
  shared_access: 'Shared access',
  no_access: 'No access',
  unknown: 'Unknown',
}

export const INTEGRATION_STATUS_LABELS: Record<DigitalIntegrationStatus, string> = {
  manual: 'Manual',
  configured: 'Configured',
  connected: 'Connected',
  syncing: 'Syncing',
  live: 'Live',
  error: 'Error',
}

export const DOMAIN_STATUS_LABELS: Record<DomainStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  transferring: 'Transferring',
  archived: 'Archived',
}

export const SSL_STATUS_LABELS: Record<DomainSslStatus, string> = {
  valid: 'Valid',
  invalid: 'Invalid',
  none: 'None',
  unknown: 'Unknown',
}

export const LISTING_PROVIDER_LABELS: Record<BusinessListingProvider, string> = {
  google_business_profile: 'Google Business Profile',
  apple_business_connect: 'Apple Business Connect',
  bing_places: 'Bing Places',
  yelp: 'Yelp',
  custom: 'Custom',
}

export const VERIFICATION_STATUS_LABELS: Record<DigitalVerificationStatus, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  pending: 'Pending',
  not_applicable: 'Not applicable',
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
}

function optionsFromLabels<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map(value => ({ value, label: labels[value] }))
}
export const WEBSITE_TYPE_OPTIONS = optionsFromLabels(WEBSITE_TYPE_LABELS)
export const WEBSITE_STATUS_OPTIONS = optionsFromLabels(WEBSITE_STATUS_LABELS)
export const OWNERSHIP_STATUS_OPTIONS = optionsFromLabels(OWNERSHIP_STATUS_LABELS)
export const DOMAIN_STATUS_OPTIONS = optionsFromLabels(DOMAIN_STATUS_LABELS)
export const SSL_STATUS_OPTIONS = optionsFromLabels(SSL_STATUS_LABELS)
export const LISTING_PROVIDER_OPTIONS = optionsFromLabels(LISTING_PROVIDER_LABELS)
export const VERIFICATION_STATUS_OPTIONS = optionsFromLabels(VERIFICATION_STATUS_LABELS)
export const LISTING_STATUS_OPTIONS = optionsFromLabels(LISTING_STATUS_LABELS)

/* ── WEBSITES: create / update / archive ──────────────────── */

export interface WebsiteFormValues {
  name: string
  url: string
  website_type: WebsiteType
  platform_cms: string
  hosting_provider: string
  status: WebsiteStatus
  ownership_status: DigitalOwnershipStatus
  launch_date: string
  notes: string
}

/**
 * Calls create_website_safe — NOT a plain insert. That RPC (see
 * sql/wave-digital-workspace/wave-2-website-domains-listings/
 * 01-create-website-safe-rpc.sql) is what decides whether this becomes the
 * client's first (and therefore automatically primary) website, inside a
 * transaction serialized per-client so two concurrent "create the first
 * website" calls can't both think they're first. Never determine primary
 * status by counting rows on the frontend first.
 *
 * No actor id or status is passed — the RPC derives the actor from
 * auth.uid() server-side (a caller-supplied actor id would let it be
 * spoofed) and always creates as 'active' (the only initial status this
 * product ever offers at creation time; editing to another status
 * afterwards still goes through updateWebsite's normal UPDATE path).
 */
export async function createWebsite(clientId: string, values: WebsiteFormValues, _ctx: Ctx): Promise<Website> {
  const { data, error } = await supabase.rpc('create_website_safe', {
    p_client_id: clientId,
    p_name: values.name.trim(),
    p_url: values.url.trim() ? normalizeUrl(values.url) : null,
    p_website_type: values.website_type,
    p_platform_cms: values.platform_cms.trim() || null,
    p_hosting_provider: values.hosting_provider.trim() || null,
    p_ownership_status: values.ownership_status,
    p_launch_date: values.launch_date || null,
    p_notes: values.notes.trim() || null,
  })
  if (error) { console.error('createWebsite:', error.message); throw new Error(parseDigitalMutationError(error.message)) }
  return data as Website
}

export async function updateWebsite(id: string, values: WebsiteFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('websites').update({
    name: values.name.trim(),
    url: values.url.trim() ? normalizeUrl(values.url) : null,
    website_type: values.website_type,
    platform_cms: values.platform_cms.trim() || null,
    hosting_provider: values.hosting_provider.trim() || null,
    status: values.status,
    ownership_status: values.ownership_status,
    launch_date: values.launch_date || null,
    notes: values.notes.trim() || null,
    updated_by: ctx.actorId,
  }).eq('id', id)
  if (error) { console.error('updateWebsite:', error.message); throw new Error(parseDigitalMutationError(error.message)) }
}

/**
 * Archive, never hard-delete — matches the lifecycle status already on the
 * schema (active/inactive/archived). Refuses to archive the current
 * primary website outright rather than silently clearing or auto-promoting
 * another one: the caller must set a different website primary first. This
 * is a product-workflow guard (not a security boundary — RLS remains
 * authoritative), enforced here so every call site gets it for free.
 */
export async function archiveWebsite(website: Website, ctx: Ctx): Promise<void> {
  if (website.is_primary) {
    throw new Error('This is the primary website. Set another website as primary before archiving it.')
  }
  const { error } = await supabase.from('websites').update({
    status: 'archived' as WebsiteStatus,
    updated_by: ctx.actorId,
  }).eq('id', website.id)
  if (error) { console.error('archiveWebsite:', error.message); throw new Error(error.message) }
}

/* ── DOMAINS: create / update / archive ───────────────────── */

export interface DomainFormValues {
  domain_name: string
  website_id: string // '' = unassigned
  registrar: string
  dns_provider: string
  registration_date: string
  expiration_date: string
  auto_renew: boolean
  ssl_status: DomainSslStatus
  ssl_expiration_date: string
  status: DomainStatus
  notes: string
}

export async function createDomain(clientId: string, values: DomainFormValues, ctx: Ctx): Promise<Domain> {
  const { data, error } = await supabase.from('domains').insert({
    agency_id: ctx.agencyId,
    client_id: clientId,
    website_id: values.website_id || null,
    domain_name: normalizeDomainName(values.domain_name),
    registrar: values.registrar.trim() || null,
    dns_provider: values.dns_provider.trim() || null,
    registration_date: values.registration_date || null,
    expiration_date: values.expiration_date || null,
    auto_renew: values.auto_renew,
    ssl_status: values.ssl_status,
    ssl_expiration_date: values.ssl_expiration_date || null,
    status: values.status,
    notes: values.notes.trim() || null,
    created_by: ctx.actorId,
    updated_by: ctx.actorId,
  }).select().single()
  if (error) { console.error('createDomain:', error.message); throw new Error(parseDigitalMutationError(error.message)) }
  return data as Domain
}

export async function updateDomain(id: string, values: DomainFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('domains').update({
    website_id: values.website_id || null,
    domain_name: normalizeDomainName(values.domain_name),
    registrar: values.registrar.trim() || null,
    dns_provider: values.dns_provider.trim() || null,
    registration_date: values.registration_date || null,
    expiration_date: values.expiration_date || null,
    auto_renew: values.auto_renew,
    ssl_status: values.ssl_status,
    ssl_expiration_date: values.ssl_expiration_date || null,
    status: values.status,
    notes: values.notes.trim() || null,
    updated_by: ctx.actorId,
  }).eq('id', id)
  if (error) { console.error('updateDomain:', error.message); throw new Error(parseDigitalMutationError(error.message)) }
}

export async function archiveDomain(domain: Domain, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('domains').update({
    status: 'archived' as DomainStatus,
    updated_by: ctx.actorId,
  }).eq('id', domain.id)
  if (error) { console.error('archiveDomain:', error.message); throw new Error(error.message) }
}

/* ── BUSINESS LISTINGS: create / update / archive ─────────── */

export interface BusinessListingFormValues {
  provider: BusinessListingProvider
  custom_provider_name: string
  business_name: string
  address: string
  phone: string
  profile_url: string
  external_listing_id: string
  verification_status: DigitalVerificationStatus
  ownership_status: DigitalOwnershipStatus
  listing_status: ListingStatus
  category: string
  rating: string       // numeric-as-string in the form; parsed on save
  review_count: string // integer-as-string in the form; parsed on save
  last_review_at: string
  notes: string
}

function listingPayload(values: BusinessListingFormValues) {
  if (values.provider === 'custom' && !values.custom_provider_name.trim()) {
    throw new Error('Enter a name for this custom listing provider.')
  }
  const rating = values.rating.trim() ? Number(values.rating) : null
  const reviewCount = values.review_count.trim() ? Math.max(0, Math.trunc(Number(values.review_count))) : 0
  return {
    provider: values.provider,
    custom_provider_name: values.provider === 'custom' ? values.custom_provider_name.trim() : null,
    business_name: values.business_name.trim() || null,
    address: values.address.trim() || null,
    phone: values.phone.trim() || null,
    profile_url: values.profile_url.trim() ? normalizeUrl(values.profile_url) : null,
    external_listing_id: values.external_listing_id.trim() || null,
    verification_status: values.verification_status,
    ownership_status: values.ownership_status,
    listing_status: values.listing_status,
    category: values.category.trim() || null,
    rating: rating === null || Number.isNaN(rating) ? null : rating,
    review_count: Number.isNaN(reviewCount) ? 0 : reviewCount,
    last_review_at: values.last_review_at || null,
    notes: values.notes.trim() || null,
  }
}

export async function createBusinessListing(clientId: string, values: BusinessListingFormValues, ctx: Ctx): Promise<BusinessListing> {
  const payload = listingPayload(values)
  const { data, error } = await supabase.from('business_listings').insert({
    ...payload,
    agency_id: ctx.agencyId,
    client_id: clientId,
    created_by: ctx.actorId,
    updated_by: ctx.actorId,
  }).select().single()
  if (error) { console.error('createBusinessListing:', error.message); throw new Error(parseDigitalMutationError(error.message)) }
  return data as BusinessListing
}

export async function updateBusinessListing(id: string, values: BusinessListingFormValues, ctx: Ctx): Promise<void> {
  const payload = listingPayload(values)
  const { error } = await supabase.from('business_listings').update({
    ...payload,
    updated_by: ctx.actorId,
  }).eq('id', id)
  if (error) { console.error('updateBusinessListing:', error.message); throw new Error(parseDigitalMutationError(error.message)) }
}

export async function archiveBusinessListing(listing: BusinessListing, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('business_listings').update({
    listing_status: 'archived' as ListingStatus,
    updated_by: ctx.actorId,
  }).eq('id', listing.id)
  if (error) { console.error('archiveBusinessListing:', error.message); throw new Error(error.message) }
}
