import { useEffect, useState } from 'react'
import {
  listWebsites, listDomains, listSocialChannels, listRecentSocialSnapshots,
  listBusinessListings, getSeoProfile, listTrackingConfigurations, listDigitalAssets,
} from '@/features/digital/api'
import * as AI from '@/features/ai/api'
import { computeDigitalHealth, DIGITAL_HEALTH_BAND_LABEL, fromSettled } from './digitalHealth'
import type { DigitalHealthResult } from './digitalHealth'
import { computeDigitalCompletion } from './digitalCompletion'
import { domainExpirationState } from './domainExpiration'
import { buildDigitalAiContext, DIGITAL_AI_ACTIONS } from './digitalIntelligence'
import type { DigitalAiContextInput } from './digitalIntelligence'
import { DIGITAL_ICONS } from './DigitalSidebar'
import { KpiCard } from '@/components/ui/KpiCard'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { DigitalSectionId } from './sections'
import type {
  Client, Website, Domain, SocialChannel,
  BusinessListing, SeoProfile, TrackingConfiguration, DigitalAsset,
} from '@/types'
import type { CompletionStatus } from '@/components/ui/CompletionDot'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onSectionChange: (id: string) => void
  onCompletionLoaded: (completion: Record<DigitalSectionId, CompletionStatus>) => void
  onRequestAI: () => void
}

type LoadState = 'loading' | 'ready' | 'all_failed'

export function DigitalOverview({ client, ctx, onSectionChange, onCompletionLoaded, onRequestAI }: Props) {
  const clientId = client.id
  const [state, setState] = useState<LoadState>('loading')
  const [health, setHealth] = useState<DigitalHealthResult | null>(null)
  const [websites, setWebsites] = useState<Website[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [socialChannels, setSocialChannels] = useState<SocialChannel[]>([])
  const [businessListings, setBusinessListings] = useState<BusinessListing[]>([])
  const [seoProfile, setSeoProfile] = useState<SeoProfile | null>(null)
  const [trackingConfigs, setTrackingConfigs] = useState<TrackingConfiguration[]>([])
  const [digitalAssets, setDigitalAssets] = useState<DigitalAsset[]>([])
  // Tracked separately from `seoProfile` (which stays null on a genuine
  // fetch failure too) so the KpiCard can tell "never assessed" apart from
  // "could not check right now" — see the SEO wording requirement.
  const [seoUnavailable, setSeoUnavailable] = useState(false)
  // Raw settled results, kept alongside the plain-array state above —
  // Digital Intelligence needs to tell a rejected source apart from a
  // genuinely empty one (§29), which the plain arrays alone can't do.
  const [aiContextInput, setAiContextInput] = useState<DigitalAiContextInput | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState('loading')
      const [
        websitesR, domainsR, socialR, snapshotsR,
        listingsR, seoR, trackingR, assetsR,
      ] = await Promise.allSettled([
        listWebsites(clientId),
        listDomains(clientId),
        listSocialChannels(clientId),
        listRecentSocialSnapshots(clientId),
        listBusinessListings(clientId),
        getSeoProfile(clientId),
        listTrackingConfigurations(clientId),
        listDigitalAssets(clientId),
      ])
      if (cancelled) return

      const results = [websitesR, domainsR, socialR, snapshotsR, listingsR, seoR, trackingR, assetsR]
      if (results.every(r => r.status === 'rejected')) {
        setState('all_failed')
        return
      }

      if (websitesR.status === 'fulfilled') setWebsites(websitesR.value)
      if (domainsR.status === 'fulfilled') setDomains(domainsR.value)
      if (socialR.status === 'fulfilled') setSocialChannels(socialR.value)
      if (listingsR.status === 'fulfilled') setBusinessListings(listingsR.value)
      if (seoR.status === 'fulfilled') setSeoProfile(seoR.value)
      else setSeoUnavailable(true)
      if (trackingR.status === 'fulfilled') setTrackingConfigs(trackingR.value)
      if (assetsR.status === 'fulfilled') setDigitalAssets(assetsR.value)

      const healthInputs = {
        websites: fromSettled(websitesR),
        domains: fromSettled(domainsR),
        socialChannels: fromSettled(socialR),
        businessListings: fromSettled(listingsR),
        seoProfile: fromSettled(seoR),
        trackingConfigurations: fromSettled(trackingR),
      }
      const healthResult = computeDigitalHealth(healthInputs)
      setHealth(healthResult)

      const completion = computeDigitalCompletion(healthResult, {
        socialSnapshots: fromSettled(snapshotsR),
        digitalAssets: fromSettled(assetsR),
      })
      onCompletionLoaded(completion)

      setAiContextInput({
        health: healthResult,
        websites: fromSettled(websitesR),
        domains: fromSettled(domainsR),
        socialChannels: fromSettled(socialR),
        socialSnapshots: fromSettled(snapshotsR),
        businessListings: fromSettled(listingsR),
        seoProfile: fromSettled(seoR),
        trackingConfigurations: fromSettled(trackingR),
        digitalAssets: fromSettled(assetsR),
      })

      setState('ready')
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  if (state === 'loading') return <OverviewSkeleton />

  if (state === 'all_failed') {
    return (
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Digital data unavailable</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Every Digital source failed to load. Try refreshing the page.</p>
      </div>
    )
  }

  const primaryWebsite = websites.find(w => w.is_primary)
  const activeSocialCount = socialChannels.filter(c => c.is_active).length
  const verifiedListingCount = businessListings.filter(l => l.verification_status === 'verified').length
  const liveTrackingCount = trackingConfigs.filter(c => c.status === 'connected' || c.status === 'syncing' || c.status === 'live').length
  const activeDomains = domains.filter(d => d.status !== 'archived')
  const expiringDomains = activeDomains.filter(d => {
    const state = domainExpirationState(d)
    return state === 'expired' || state === 'expiring_soon'
  })

  const attentionItems = buildAttentionItems({
    primaryWebsite, websites, activeDomains, socialChannels, businessListings, trackingConfigs, seoProfile, seoUnavailable,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Digital Health ──────────────────────────────────── */}
      {health && <DigitalHealthCard health={health} onSectionChange={onSectionChange} />}

      {/* ── Presence Summary ────────────────────────────────── */}
      <SummarySection title="Presence">
        <KpiCard
          label="Websites"
          value={websites.length}
          hint={primaryWebsite ? primaryWebsite.name : websites.length > 0 ? 'No primary set' : 'None on file'}
          accent="violet"
        />
        <KpiCard
          label="Domains"
          value={activeDomains.length}
          hint={expiringDomains.length > 0 ? `${expiringDomains.length} need attention` : undefined}
          accent={expiringDomains.length > 0 ? 'gold' : 'violet'}
        />
        <KpiCard
          label="Social Channels"
          value={activeSocialCount}
          hint={socialChannels.length > activeSocialCount ? `${socialChannels.length - activeSocialCount} inactive` : undefined}
          accent="violet"
        />
        <KpiCard
          label="Business Listings"
          value={businessListings.length}
          hint={businessListings.length > 0 ? `${verifiedListingCount} verified` : undefined}
          accent="violet"
        />
      </SummarySection>

      {/* ── Infrastructure Summary ──────────────────────────── */}
      <SummarySection title="Infrastructure">
        <KpiCard
          label="Tracking Configured"
          value={trackingConfigs.length}
          hint={trackingConfigs.length > 0 ? `${liveTrackingCount} connected` : undefined}
          accent="muted"
        />
        <KpiCard
          label="SEO Status"
          value={seoStatusLabel(seoProfile, seoUnavailable)}
          accent="muted"
        />
        <KpiCard
          label="Digital Assets Linked"
          value={digitalAssets.length}
          accent="muted"
        />
      </SummarySection>

      {/* ── Attention / Gaps ─────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 12 }}>
            Needs Attention
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attentionItems.map((item, i) => (
              <button
                key={i}
                onClick={() => onSectionChange(item.sectionId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px',
                  borderRadius: 10, fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-soft)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 12, color: 'var(--violet)', fontWeight: 600 }}>Review →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Digital Intelligence ─────────────────────────────── */}
      <DigitalIntelligenceCard
        client={client}
        ctx={ctx}
        contextInput={aiContextInput}
        onOpenFullAssistant={onRequestAI}
      />
    </div>
  )
}

/* ── Digital Intelligence card ───────────────────────────────
   Reuses the existing per-client AI Project Assistant pipeline (see
   AiTab.tsx: kind: 'analysis' on the ai-generate Edge Function) — same
   Anthropic key held server-side, same ai_generations logging, no new AI
   product. This card only builds a Digital-specific structured context
   (digitalIntelligence.ts) and presents the answer inline, since Digital
   has no dedicated nav item to send a full chat to (§26). */

function DigitalIntelligenceCard({ client, ctx, contextInput, onOpenFullAssistant }: {
  client: Client
  ctx: { agencyId: string; actorId: string }
  contextInput: DigitalAiContextInput | null
  onOpenFullAssistant: () => void
}) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    const text = q.trim()
    if (!text || loading || !contextInput) return
    setLoading(true); setError(null); setAnswer(null)
    try {
      const brief = buildDigitalAiContext(client, contextInput, text)
      const outcome = await AI.generate(brief, 1, 'analysis', { agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: client.id })
      if (outcome.error) throw new Error(outcome.error)
      if (outcome.notConfigured) throw new Error('AI is not configured yet. Set an Anthropic API key in Supabase Secrets.')
      const summary = (outcome.result as unknown as { summary?: string })?.summary
      if (!summary) throw new Error('No response received from AI.')
      setAnswer(summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate Digital Intelligence')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
          Digital Intelligence
        </p>
        <button
          onClick={onOpenFullAssistant}
          style={{ background: 'none', border: 'none', color: 'var(--violet)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
        >
          Open full AI Assistant →
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {DIGITAL_AI_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => ask(a.query)}
            disabled={loading || !contextInput}
            style={{
              padding: '7px 12px', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 999,
              cursor: loading || !contextInput ? 'default' : 'pointer', color: 'var(--ink)',
              opacity: loading || !contextInput ? 0.55 : 1,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {answer && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline-2)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>{answer}</p>
        </div>
      )}
      {loading && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, padding: '4px 2px' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', animation: `dig-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      )}
      {error && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Textarea label="" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about this client's digital infrastructure…" rows={1} />
        </div>
        <Button variant="primary" size="sm" loading={loading} disabled={!question.trim() || !contextInput} onClick={() => { ask(question); setQuestion('') }}>
          Ask
        </Button>
      </div>

      <style>{`@keyframes dig-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
    </div>
  )
}

/* ── Digital Health card ─────────────────────────────────── */

const BAND_COLOR: Record<string, string> = {
  unknown: 'var(--muted)',
  not_started: 'var(--muted)',
  attention: 'var(--danger)',
  developing: 'var(--warning)',
  strong: 'var(--success)',
}

function DigitalHealthCard({ health, onSectionChange }: { health: DigitalHealthResult; onSectionChange: (id: string) => void }) {
  const color = BAND_COLOR[health.band]
  return (
    <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 4 }}>
            Digital Health
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
              {health.score === null ? '—' : `${health.score}%`}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{DIGITAL_HEALTH_BAND_LABEL[health.band]}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {health.dimensions.map(dim => {
          const Icon = DIGITAL_ICONS[dim.sectionId as DigitalSectionId]
          return (
            <button
              key={dim.id}
              onClick={() => onSectionChange(dim.sectionId)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left',
                background: 'var(--surface-solid)', border: '1px solid var(--hairline-2)', borderRadius: 12,
                padding: '10px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                {Icon && <Icon size={13} aria-hidden="true" />}
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{dim.label}</span>
              </div>
              <span style={{ fontSize: 12, color: dimStatusColor(dim.status), fontWeight: 600 }}>
                {dim.statusLabel ?? dimStatusLabel(dim.status)}
              </span>
              {dim.tip && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dim.tip}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function dimStatusLabel(status: string): string {
  if (status === 'complete') return 'Complete'
  if (status === 'partial') return 'Partial'
  if (status === 'unknown') return 'Unavailable'
  return 'Empty'
}
function dimStatusColor(status: string): string {
  if (status === 'complete') return 'var(--success)'
  if (status === 'partial') return 'var(--warning)'
  if (status === 'unknown') return 'var(--muted)'
  return 'var(--muted)'
}

/* ── Summary section wrapper ─────────────────────────────── */

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {children}
      </div>
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────── */

// QUERY SUCCEEDED + no profile/assessment yet → "Not assessed".
// QUERY FAILED → "Unavailable". These must never be the same word — see
// seoDimension() in digitalHealth.ts for the matching health-card fix.
function seoStatusLabel(profile: SeoProfile | null, unavailable: boolean): string {
  if (unavailable) return 'Unavailable'
  if (!profile || profile.technical_health_status === 'unknown') return 'Not assessed'
  if (profile.technical_health_status === 'healthy') return 'Healthy'
  if (profile.technical_health_status === 'issue') return 'Needs review'
  return 'Not configured'
}

interface AttentionItem { label: string; sectionId: string }

// Every condition here is either a real, known state (not a guess from
// missing data) or an explicit aggregate count — "5 domains expire within
// 30 days" rather than five separate lines. UNKNOWN values are never
// treated as a problem; only genuinely known bad states raise an alert.
function buildAttentionItems(args: {
  primaryWebsite: Website | undefined
  websites: Website[]
  activeDomains: Domain[]
  socialChannels: SocialChannel[]
  businessListings: BusinessListing[]
  trackingConfigs: TrackingConfiguration[]
  seoProfile: SeoProfile | null
  seoUnavailable: boolean
}): AttentionItem[] {
  const items: AttentionItem[] = []

  if (!args.primaryWebsite) items.push({ label: 'No primary website set', sectionId: 'website' })

  const noAccessWebsites = args.websites.filter(w => w.status !== 'archived' && w.ownership_status === 'no_access')
  if (noAccessWebsites.length > 0) {
    items.push({ label: pluralize(noAccessWebsites.length, 'website has', 'websites have') + ' no ownership/access on file', sectionId: 'website' })
  }

  const expired = args.activeDomains.filter(d => domainExpirationState(d) === 'expired')
  const expiringSoon = args.activeDomains.filter(d => domainExpirationState(d) === 'expiring_soon')
  if (expired.length > 0) items.push({ label: `${pluralize(expired.length, 'domain has', 'domains have')} expired`, sectionId: 'domains' })
  if (expiringSoon.length > 0) items.push({ label: `${pluralize(expiringSoon.length, 'domain expires', 'domains expire')} within 30 days`, sectionId: 'domains' })

  const sslIssue = args.activeDomains.filter(d => d.ssl_status === 'invalid' || d.ssl_status === 'none')
  if (sslIssue.length > 0) items.push({ label: `${pluralize(sslIssue.length, 'domain is', 'domains are')} missing valid SSL`, sectionId: 'domains' })

  const activeSocial = args.socialChannels.filter(c => c.is_active)
  const noAccessSocial = activeSocial.filter(c => c.ownership_status === 'no_access')
  if (noAccessSocial.length > 0) items.push({ label: `${pluralize(noAccessSocial.length, 'social account is', 'social accounts are')} missing access`, sectionId: 'social-channels' })

  const noProfileUrlSocial = activeSocial.filter(c => !c.profile_url)
  if (noProfileUrlSocial.length > 0) items.push({ label: `${pluralize(noProfileUrlSocial.length, 'social channel has', 'social channels have')} no profile URL`, sectionId: 'social-channels' })

  // MANUAL and UNKNOWN are valid, expected Wave 3 states — only a genuine
  // connection error is worth surfacing here.
  const errorSocial = activeSocial.filter(c => c.integration_status === 'error')
  if (errorSocial.length > 0) items.push({ label: `${pluralize(errorSocial.length, 'social channel has', 'social channels have')} a connection error`, sectionId: 'social-channels' })

  const activeListings = args.businessListings.filter(l => l.listing_status !== 'archived')
  if (activeListings.length === 0) {
    items.push({ label: 'No business listings on file', sectionId: 'business-listings' })
  } else {
    const unverified = activeListings.filter(l => l.verification_status === 'unverified')
    if (unverified.length > 0) items.push({ label: `${pluralize(unverified.length, 'listing is', 'listings are')} unverified`, sectionId: 'business-listings' })

    const noAccessListings = activeListings.filter(l => l.ownership_status === 'no_access')
    if (noAccessListings.length > 0) items.push({ label: `${pluralize(noAccessListings.length, 'listing has', 'listings have')} no ownership/access on file`, sectionId: 'business-listings' })

    const inactiveListings = activeListings.filter(l => l.listing_status === 'inactive')
    if (inactiveListings.length > 0) items.push({ label: `${pluralize(inactiveListings.length, 'listing is', 'listings are')} inactive`, sectionId: 'business-listings' })

    const missingUrl = activeListings.filter(l => !l.profile_url)
    if (missingUrl.length > 0) items.push({ label: `${pluralize(missingUrl.length, 'listing is', 'listings are')} missing a profile URL`, sectionId: 'business-listings' })
  }

  if (args.trackingConfigs.length === 0) {
    items.push({ label: 'No analytics or tracking configured', sectionId: 'tracking-analytics' })
  } else {
    // MANUAL and CONFIGURED are valid, expected Wave 4 states (§18: no
    // live external APIs this wave) — only a genuine connection error is
    // worth surfacing here, same posture as the social-channel check above.
    const trackingErrors = args.trackingConfigs.filter(c => c.status === 'error')
    if (trackingErrors.length > 0) {
      items.push({ label: `${pluralize(trackingErrors.length, 'tracking configuration has', 'tracking configurations have')} a connection error`, sectionId: 'tracking-analytics' })
    }
  }

  // SEO: only raise an alert for KNOWN states — never assessed yet,
  // genuinely unreachable, or an explicit 'issue' the user recorded.
  // Never manufactured from a field that simply wasn't filled in.
  if (args.seoUnavailable) {
    items.push({ label: 'SEO status could not be checked', sectionId: 'seo' })
  } else if (!args.seoProfile) {
    items.push({ label: 'SEO has not been assessed yet', sectionId: 'seo' })
  } else {
    const p = args.seoProfile
    if (p.indexing_status === 'issue') items.push({ label: 'Indexing has a known issue', sectionId: 'seo' })
    if (p.sitemap_status === 'issue') items.push({ label: 'Sitemap has a known issue', sectionId: 'seo' })
    if (p.robots_status === 'issue') items.push({ label: 'Robots.txt has a known issue', sectionId: 'seo' })
    const criticalIssues = p.issues.filter(i => i.severity === 'high').length
    if (criticalIssues > 0) items.push({ label: `${pluralize(criticalIssues, 'critical SEO issue', 'critical SEO issues')} flagged`, sectionId: 'seo' })
  }

  return items
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function OverviewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 150, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.3 }} />)}
      </div>
    </div>
  )
}
