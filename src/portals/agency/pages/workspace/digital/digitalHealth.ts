import type { DigitalSectionId } from './sections'
import type {
  Website, Domain, SocialChannel, BusinessListing, SeoProfile, TrackingConfiguration,
} from '@/types'

/* ── Status model ──────────────────────────────────────────
   Mirrors CompletionDot's model (components/ui/CompletionDot.tsx) exactly —
   UNKNOWN is a first-class state, distinct from EMPTY. EMPTY means "the
   query succeeded and there is genuinely nothing here yet." UNKNOWN means
   "the query failed or this has not been assessed" — it must never be
   silently presented as EMPTY, or a failed request would look identical to
   a client with no digital presence at all. */
export type DigitalDimensionStatus = 'complete' | 'partial' | 'empty' | 'unknown'

export interface DigitalDimension {
  id: string
  label: string
  status: DigitalDimensionStatus
  sectionId: DigitalSectionId
  tip: string | null
  /**
   * Overrides the generic word shown for `status` (see dimStatusLabel in
   * DigitalOverview.tsx) when it would be misleading. Needed specifically
   * because 'unknown' covers two different real conditions — a failed
   * fetch ("Unavailable") and a successful query with nothing to assess
   * yet ("Not assessed") — that must never share the same displayed word
   * even though they share the same status value (see seoDimension below).
   */
  statusLabel?: string
}

export type DigitalHealthBand = 'unknown' | 'not_started' | 'attention' | 'developing' | 'strong'

export interface DigitalHealthResult {
  /** null when every dimension is 'unknown' — nothing could be evaluated. */
  score: number | null
  band: DigitalHealthBand
  dimensions: DigitalDimension[]
}

/* ── Per-source resolution ─────────────────────────────────
   Overview resolves each of the 6 sources independently via
   Promise.allSettled (see DigitalOverview.tsx) — one failed source must
   never take down the whole page or misreport as empty. Each of these
   dimension builders takes the settled result directly. */

export interface SourceResult<T> {
  status: 'fulfilled' | 'rejected'
  value?: T
}

function fromSettled<T>(r: PromiseSettledResult<T>): SourceResult<T> {
  return r.status === 'fulfilled' ? { status: 'fulfilled', value: r.value } : { status: 'rejected' }
}
export { fromSettled }

/* ── Website Presence ──────────────────────────────────────
   complete: a primary website is documented.
   partial:  website(s) exist but none marked primary.
   empty:    no websites recorded at all. */
function websiteDimension(websites: SourceResult<Website[]>): DigitalDimension {
  if (websites.status === 'rejected') {
    return { id: 'website', label: 'Website', status: 'unknown', sectionId: 'website', tip: 'Could not load website data' }
  }
  const list = websites.value ?? []
  const hasPrimary = list.some(w => w.is_primary && w.status !== 'archived')
  const hasAny = list.some(w => w.status !== 'archived')
  return {
    id: 'website',
    label: 'Website',
    status: hasPrimary ? 'complete' : hasAny ? 'partial' : 'empty',
    sectionId: 'website',
    tip: !hasAny ? 'No website on file' : !hasPrimary ? 'No primary website set' : null,
  }
}

/* ── Domain Health ─────────────────────────────────────────
   complete: at least one domain, none expired or missing SSL info.
   partial:  domains exist but one has an issue (expired, or SSL
             unknown/invalid).
   empty:    no domains recorded. */
function domainDimension(domains: SourceResult<Domain[]>): DigitalDimension {
  if (domains.status === 'rejected') {
    return { id: 'domains', label: 'Domains', status: 'unknown', sectionId: 'domains', tip: 'Could not load domain data' }
  }
  const list = (domains.value ?? []).filter(d => d.status !== 'archived')
  if (list.length === 0) {
    return { id: 'domains', label: 'Domains', status: 'empty', sectionId: 'domains', tip: 'No domains on file' }
  }
  const expired = list.filter(d => d.status === 'expired')
  const sslIssue = list.filter(d => d.ssl_status === 'invalid' || d.ssl_status === 'none')
  const healthy = expired.length === 0 && sslIssue.length === 0
  return {
    id: 'domains',
    label: 'Domains',
    status: healthy ? 'complete' : 'partial',
    sectionId: 'domains',
    tip: expired.length > 0 ? `${expired.length} expired` : sslIssue.length > 0 ? `${sslIssue.length} missing SSL` : null,
  }
}

/* ── Social Presence ───────────────────────────────────────
   complete: 2+ active social channels documented.
   partial:  1 active channel.
   empty:    none. */
function socialDimension(channels: SourceResult<SocialChannel[]>): DigitalDimension {
  if (channels.status === 'rejected') {
    return { id: 'social-channels', label: 'Social Channels', status: 'unknown', sectionId: 'social-channels', tip: 'Could not load social data' }
  }
  const activeCount = (channels.value ?? []).filter(c => c.is_active).length
  return {
    id: 'social-channels',
    label: 'Social Channels',
    status: activeCount >= 2 ? 'complete' : activeCount === 1 ? 'partial' : 'empty',
    sectionId: 'social-channels',
    tip: activeCount === 0 ? 'No social accounts on file' : null,
  }
}

/* ── Business Listings ─────────────────────────────────────
   complete: any listing is verified.
   partial:  listing(s) exist, none verified yet.
   empty:    none on file. Every dimension here is equally weighted, so a
             client that genuinely has no local-listing need (a global
             ecommerce-only brand, say) is not disproportionately penalised
             — see the health weighting below. */
function listingDimension(listings: SourceResult<BusinessListing[]>): DigitalDimension {
  if (listings.status === 'rejected') {
    return { id: 'business-listings', label: 'Business Listings', status: 'unknown', sectionId: 'business-listings', tip: 'Could not load listings data' }
  }
  const list = (listings.value ?? []).filter(l => l.listing_status !== 'archived')
  const verified = list.filter(l => l.verification_status === 'verified')
  return {
    id: 'business-listings',
    label: 'Business Listings',
    status: verified.length > 0 ? 'complete' : list.length > 0 ? 'partial' : 'empty',
    sectionId: 'business-listings',
    tip: list.length === 0 ? 'No listings on file' : verified.length === 0 ? 'None verified yet' : null,
  }
}

/* ── SEO Readiness ─────────────────────────────────────────
   UNKNOWN here means genuinely different things from EMPTY:
     - no seo_profiles row at all → 'unknown' (never assessed — this is
       NOT the same as "checked and found nothing").
     - a row exists but technical_health_status is itself 'unknown' →
       still 'unknown' (assessed as far as Eliora can tell, but no verdict).
     - a row exists with real signals → complete/partial by those signals. */
function seoDimension(profile: SourceResult<SeoProfile | null>): DigitalDimension {
  if (profile.status === 'rejected') {
    // Query FAILED — this is the one case that should ever read "Unavailable".
    return { id: 'seo', label: 'SEO', status: 'unknown', sectionId: 'seo', tip: 'Could not load SEO data', statusLabel: 'Unavailable' }
  }
  const p = profile.value
  if (!p || p.technical_health_status === 'unknown') {
    // Query SUCCEEDED, there is just no assessment yet — this must read
    // "Not assessed", never "Unavailable" (that word is reserved for the
    // rejected branch above). No separate tip needed: the status word
    // itself already says everything there is to say here.
    return { id: 'seo', label: 'SEO', status: 'unknown', sectionId: 'seo', tip: null, statusLabel: 'Not assessed' }
  }
  if (p.technical_health_status === 'healthy') {
    return { id: 'seo', label: 'SEO', status: 'complete', sectionId: 'seo', tip: null }
  }
  return {
    id: 'seo', label: 'SEO',
    status: p.technical_health_status === 'issue' ? 'partial' : 'empty',
    sectionId: 'seo',
    tip: p.technical_health_status === 'issue' ? 'Technical issues found' : 'Not configured',
  }
}

/* ── Tracking Readiness ────────────────────────────────────
   complete: any provider connected/syncing/live.
   partial:  configured but not yet connected.
   empty:    nothing configured. Does not require every possible provider —
             one working analytics setup is enough to read as complete. */
function trackingDimension(configs: SourceResult<TrackingConfiguration[]>): DigitalDimension {
  if (configs.status === 'rejected') {
    return { id: 'tracking-analytics', label: 'Tracking & Analytics', status: 'unknown', sectionId: 'tracking-analytics', tip: 'Could not load tracking data' }
  }
  const list = configs.value ?? []
  const live = list.some(c => c.status === 'connected' || c.status === 'syncing' || c.status === 'live')
  return {
    id: 'tracking-analytics',
    label: 'Tracking & Analytics',
    status: live ? 'complete' : list.length > 0 ? 'partial' : 'empty',
    sectionId: 'tracking-analytics',
    tip: list.length === 0 ? 'No tracking configured' : !live ? 'Configured but not connected' : null,
  }
}

/* ── Overall score ─────────────────────────────────────────
   Social Tracker and Digital Assets are deliberately NOT scored dimensions:
   a brand-new client has no historical metrics yet by definition (Social
   Tracker) and no digital-specific file categorization yet either (Digital
   Assets) — neither should make a fresh Digital Workspace read as
   "incomplete." They surface in the Overview as informational, not as
   health inputs.

   'unknown' dimensions are excluded from BOTH the numerator and the
   denominator — a failed fetch must not drag the score down OR up. If
   every dimension is unknown, score is null and the band is 'unknown'
   rather than a misleading 0 or 100.

   If every evaluable dimension is 'empty' (a freshly created client with
   zero Digital records anywhere), the band is 'not_started' — this reads
   as "nothing entered yet," not as a failing grade. */
const DIMENSION_WEIGHTS: Record<string, number> = {
  website: 0.28,
  domains: 0.16,
  'social-channels': 0.20,
  'business-listings': 0.16,
  seo: 0.12,
  'tracking-analytics': 0.08,
}

function statusPoints(status: DigitalDimensionStatus): number {
  if (status === 'complete') return 100
  if (status === 'partial') return 50
  return 0 // empty
}

export interface DigitalHealthInputs {
  websites: SourceResult<Website[]>
  domains: SourceResult<Domain[]>
  socialChannels: SourceResult<SocialChannel[]>
  businessListings: SourceResult<BusinessListing[]>
  seoProfile: SourceResult<SeoProfile | null>
  trackingConfigurations: SourceResult<TrackingConfiguration[]>
}

export function computeDigitalHealth(inputs: DigitalHealthInputs): DigitalHealthResult {
  const dimensions: DigitalDimension[] = [
    websiteDimension(inputs.websites),
    domainDimension(inputs.domains),
    socialDimension(inputs.socialChannels),
    listingDimension(inputs.businessListings),
    seoDimension(inputs.seoProfile),
    trackingDimension(inputs.trackingConfigurations),
  ]

  const evaluable = dimensions.filter(d => d.status !== 'unknown')

  if (evaluable.length === 0) {
    return { score: null, band: 'unknown', dimensions }
  }

  const totalWeight = evaluable.reduce((sum, d) => sum + (DIMENSION_WEIGHTS[d.id] ?? 0), 0)
  const weightedScore = totalWeight === 0 ? 0 : Math.round(
    evaluable.reduce((sum, d) => sum + statusPoints(d.status) * (DIMENSION_WEIGHTS[d.id] ?? 0), 0) / totalWeight,
  )

  const allEmpty = evaluable.every(d => d.status === 'empty')
  const band: DigitalHealthBand =
    allEmpty ? 'not_started' :
    weightedScore >= 75 ? 'strong' :
    weightedScore >= 40 ? 'developing' :
    'attention'

  return { score: allEmpty ? 0 : weightedScore, band, dimensions }
}

export const DIGITAL_HEALTH_BAND_LABEL: Record<DigitalHealthBand, string> = {
  unknown:     'Status unavailable',
  not_started: 'Not started',
  attention:   'Needs attention',
  developing:  'Developing',
  strong:      'Strong',
}
