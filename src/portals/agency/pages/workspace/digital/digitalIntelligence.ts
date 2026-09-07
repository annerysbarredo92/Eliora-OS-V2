import type {
  Client, Website, Domain, SocialChannel, SocialChannelSnapshot,
  BusinessListing, SeoProfile, TrackingConfiguration, DigitalAsset,
} from '@/types'
import type { DigitalHealthResult, SourceResult } from './digitalHealth'
import { DIGITAL_HEALTH_BAND_LABEL } from './digitalHealth'
import { domainExpirationState } from './domainExpiration'

/* ── Digital Intelligence context builder ────────────────────
   Produces a FLAT, filtered Record<string,string> — the shape the
   existing ai-generate Edge Function's 'analysis' prompt builder expects
   (it renders `- key: value` lines from Object.entries; a nested object
   or array would render as "[object Object]"). Every value here is a
   pre-summarized sentence, never a raw record dump (Wave 4 §28).

   EMPTY / UNKNOWN / ERROR / KNOWN BAD stay distinct (§29):
     - a rejected source reads "could not be loaded" — never "none".
     - a successful-but-empty source reads "none on file" / "not
       assessed yet" — never silently omitted or treated as a problem.
     - only a genuinely known-bad state (expired domain, connection
       error, missing ownership) is described as an issue. */

function summarize<T>(
  r: SourceResult<T[]>,
  emptyMsg: string,
  describe: (list: T[]) => string,
): string {
  if (r.status === 'rejected') return 'Could not be loaded right now — treat as unknown, not as empty or broken.'
  const list = r.value ?? []
  if (list.length === 0) return emptyMsg
  return describe(list)
}

export interface DigitalAiContextInput {
  health: DigitalHealthResult
  websites: SourceResult<Website[]>
  domains: SourceResult<Domain[]>
  socialChannels: SourceResult<SocialChannel[]>
  socialSnapshots: SourceResult<SocialChannelSnapshot[]>
  businessListings: SourceResult<BusinessListing[]>
  seoProfile: SourceResult<SeoProfile | null>
  trackingConfigurations: SourceResult<TrackingConfiguration[]>
  digitalAssets: SourceResult<DigitalAsset[]>
}

export function buildDigitalAiContext(client: Client, input: DigitalAiContextInput, question: string): Record<string, string> {
  const ctx: Record<string, string> = {
    question,
    client_name: client.business_name,
    digital_health_score: input.health.score === null
      ? 'Unknown — not enough Digital sources loaded successfully to compute a score'
      : `${input.health.score}% (${DIGITAL_HEALTH_BAND_LABEL[input.health.band]})`,
  }

  ctx.website_summary = summarize(
    input.websites,
    'No websites on file.',
    list => {
      const primary = list.find(w => w.is_primary && w.status !== 'archived')
      const active = list.filter(w => w.status !== 'archived')
      const noAccess = active.filter(w => w.ownership_status === 'no_access').length
      return [
        primary ? `Primary website: ${primary.name}${primary.url ? ` (${primary.url})` : ''}.` : 'No primary website is set.',
        `${active.length} active website(s) on file.`,
        noAccess > 0 ? `${noAccess} website(s) have no recorded ownership/access.` : null,
      ].filter(Boolean).join(' ')
    },
  )

  ctx.domain_summary = summarize(
    input.domains,
    'No domains on file.',
    list => {
      const active = list.filter(d => d.status !== 'archived')
      const expired = active.filter(d => domainExpirationState(d) === 'expired').length
      const expiringSoon = active.filter(d => domainExpirationState(d) === 'expiring_soon').length
      const sslIssue = active.filter(d => d.ssl_status === 'invalid' || d.ssl_status === 'none').length
      return [
        `${active.length} active domain(s) on file.`,
        expired > 0 ? `${expired} expired.` : null,
        expiringSoon > 0 ? `${expiringSoon} expiring within 30 days.` : null,
        sslIssue > 0 ? `${sslIssue} missing valid SSL.` : null,
      ].filter(Boolean).join(' ')
    },
  )

  ctx.social_channel_summary = summarize(
    input.socialChannels,
    'No social accounts on file.',
    list => {
      const active = list.filter(c => c.is_active)
      const platforms = Array.from(new Set(active.map(c => c.platform === 'other' ? (c.platform_other_label ?? 'other') : c.platform)))
      const noAccess = active.filter(c => c.ownership_status === 'no_access').length
      const errored = active.filter(c => c.integration_status === 'error').length
      const missingUrl = active.filter(c => !c.profile_url).length
      return [
        `${active.length} active social channel(s) across: ${platforms.join(', ') || 'none'}.`,
        noAccess > 0 ? `${noAccess} missing ownership/access.` : null,
        errored > 0 ? `${errored} in a connection error state.` : null,
        missingUrl > 0 ? `${missingUrl} missing a profile URL.` : null,
      ].filter(Boolean).join(' ')
    },
  )

  ctx.social_tracker_summary = summarize(
    input.socialSnapshots,
    'No social tracking history recorded yet — this is expected for a new client and is not itself a problem.',
    list => {
      const mostRecent = list.reduce((max, s) => s.snapshot_date > max ? s.snapshot_date : max, list[0].snapshot_date)
      const trackedChannels = new Set(list.map(s => s.social_channel_id)).size
      return `${trackedChannels} channel(s) have tracked metrics; most recent snapshot recorded ${mostRecent}.`
    },
  )

  ctx.business_listing_summary = summarize(
    input.businessListings,
    'No business listings on file.',
    list => {
      const active = list.filter(l => l.listing_status !== 'archived')
      const verified = active.filter(l => l.verification_status === 'verified').length
      const noAccess = active.filter(l => l.ownership_status === 'no_access').length
      return [
        `${active.length} active listing(s) on file, ${verified} verified.`,
        noAccess > 0 ? `${noAccess} missing ownership/access.` : null,
      ].filter(Boolean).join(' ')
    },
  )

  if (input.seoProfile.status === 'rejected') {
    ctx.seo_summary = 'SEO status could not be loaded right now — treat as unknown, not as unassessed.'
  } else {
    const p = input.seoProfile.value
    if (!p || p.technical_health_status === 'unknown') {
      ctx.seo_summary = 'No technical SEO assessment has been recorded for this client yet. This means "not assessed", not "known to have SEO problems".'
    } else {
      const issues = p.issues.length > 0 ? ` Known issues: ${p.issues.map(i => `${i.label} (${i.severity})`).join('; ')}.` : ''
      ctx.seo_summary = `Technical health: ${p.technical_health_status}. Indexing: ${p.indexing_status}, sitemap: ${p.sitemap_status}, robots: ${p.robots_status}, Search Console: ${p.search_console_status}.${issues}`
    }
  }

  ctx.tracking_summary = summarize(
    input.trackingConfigurations,
    'No analytics or tracking configured yet.',
    list => {
      const providers = Array.from(new Set(list.map(c => c.provider === 'custom' ? (c.custom_provider_name ?? 'custom') : c.provider)))
      const errored = list.filter(c => c.status === 'error').length
      const manualOnly = list.filter(c => c.status === 'manual' || c.status === 'configured').length
      return [
        `${list.length} tracking configuration(s): ${providers.join(', ')}.`,
        errored > 0 ? `${errored} in a connection error state.` : null,
        manualOnly > 0 ? `${manualOnly} are manual/configured entries with no live connection — this is a valid, expected state, not a problem by itself.` : null,
      ].filter(Boolean).join(' ')
    },
  )

  ctx.digital_assets_summary = summarize(
    input.digitalAssets,
    'No Digital Assets (favicons, logos, technical documents, etc.) linked yet.',
    list => `${list.length} Digital Asset reference(s) linked, across categories: ${Array.from(new Set(list.map(a => a.category))).join(', ')}.`,
  )

  return ctx
}

export const DIGITAL_AI_ACTIONS: { label: string; query: string }[] = [
  {
    label: 'Digital Health Summary',
    query: 'Give me a summary of this client\'s overall digital health — what\'s strong, what\'s missing, and what I need to know at a glance.',
  },
  {
    label: 'Digital Risk Review',
    query: 'What are the real, known digital risks for this client right now — expiring domains, ownership gaps, connection errors, or anything else in their digital infrastructure? Only flag genuinely known problems; do not treat something that has simply never been assessed as a risk by itself.',
  },
  {
    label: 'Infrastructure Priorities',
    query: 'Based on this client\'s current digital infrastructure, what should be prioritized next to strengthen their digital presence?',
  },
  {
    label: 'SEO Readiness Review',
    query: 'Review this client\'s technical SEO readiness based on the data provided. If SEO has not been assessed yet, say so plainly rather than assuming a problem exists.',
  },
  {
    label: 'Tracking Readiness Review',
    query: 'Review this client\'s analytics and tracking configuration readiness. Note any tracking that is not yet configured or has a connection error — manual/configured entries with no live connection are expected and not themselves a problem.',
  },
  {
    label: 'Channel Infrastructure Review',
    query: 'Review this client\'s social channel and business listing infrastructure — ownership, access, and completeness. Only comment on infrastructure readiness, not on posting or content activity.',
  },
]
