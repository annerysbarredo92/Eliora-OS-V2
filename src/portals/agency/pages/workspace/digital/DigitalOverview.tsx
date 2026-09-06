import { useEffect, useState } from 'react'
import {
  listWebsites, listDomains, listSocialChannels, listRecentSocialSnapshots,
  listBusinessListings, getSeoProfile, listTrackingConfigurations, listDigitalAssets,
} from '@/features/digital/api'
import { computeDigitalHealth, DIGITAL_HEALTH_BAND_LABEL, fromSettled } from './digitalHealth'
import type { DigitalHealthResult } from './digitalHealth'
import { computeDigitalCompletion } from './digitalCompletion'
import { DIGITAL_ICONS } from './DigitalSidebar'
import { KpiCard } from '@/components/ui/KpiCard'
import type { DigitalSectionId } from './sections'
import type {
  Website, Domain, SocialChannel,
  BusinessListing, SeoProfile, TrackingConfiguration, DigitalAsset,
} from '@/types'
import type { CompletionStatus } from '@/components/ui/CompletionDot'

interface Props {
  clientId: string
  onSectionChange: (id: string) => void
  onCompletionLoaded: (completion: Record<DigitalSectionId, CompletionStatus>) => void
}

type LoadState = 'loading' | 'ready' | 'all_failed'

export function DigitalOverview({ clientId, onSectionChange, onCompletionLoaded }: Props) {
  const [state, setState] = useState<LoadState>('loading')
  const [health, setHealth] = useState<DigitalHealthResult | null>(null)
  const [websites, setWebsites] = useState<Website[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [socialChannels, setSocialChannels] = useState<SocialChannel[]>([])
  const [businessListings, setBusinessListings] = useState<BusinessListing[]>([])
  const [seoProfile, setSeoProfile] = useState<SeoProfile | null>(null)
  const [trackingConfigs, setTrackingConfigs] = useState<TrackingConfiguration[]>([])
  const [digitalAssets, setDigitalAssets] = useState<DigitalAsset[]>([])

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
  const expiringDomains = domains.filter(d => d.status === 'active' && d.expiration_date && daysUntil(d.expiration_date) <= 30)

  const attentionItems = buildAttentionItems({
    health, primaryWebsite, expiringDomains, socialChannels, businessListings, trackingConfigs, seoProfile,
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
          value={domains.filter(d => d.status !== 'archived').length}
          hint={expiringDomains.length > 0 ? `${expiringDomains.length} expiring soon` : undefined}
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
          value={seoStatusLabel(seoProfile)}
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
                {dimStatusLabel(dim.status)}
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

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function seoStatusLabel(profile: SeoProfile | null): string {
  if (!profile || profile.technical_health_status === 'unknown') return 'Not assessed'
  if (profile.technical_health_status === 'healthy') return 'Healthy'
  if (profile.technical_health_status === 'issue') return 'Needs review'
  return 'Not configured'
}

interface AttentionItem { label: string; sectionId: string }

function buildAttentionItems(args: {
  health: DigitalHealthResult | null
  primaryWebsite: Website | undefined
  expiringDomains: Domain[]
  socialChannels: SocialChannel[]
  businessListings: BusinessListing[]
  trackingConfigs: TrackingConfiguration[]
  seoProfile: SeoProfile | null
}): AttentionItem[] {
  const items: AttentionItem[] = []

  if (!args.primaryWebsite) items.push({ label: 'No primary website set', sectionId: 'website' })
  for (const d of args.expiringDomains) {
    items.push({ label: `Domain ${d.domain_name} expires within 30 days`, sectionId: 'domains' })
  }
  const noAccessSocial = args.socialChannels.filter(c => c.ownership_status === 'no_access')
  if (noAccessSocial.length > 0) items.push({ label: `${noAccessSocial.length} social account(s) missing access`, sectionId: 'social-channels' })

  if (args.businessListings.length === 0) items.push({ label: 'No business listings on file', sectionId: 'business-listings' })
  const unverified = args.businessListings.filter(l => l.verification_status === 'unverified')
  if (unverified.length > 0) items.push({ label: `${unverified.length} listing(s) unverified`, sectionId: 'business-listings' })

  if (args.trackingConfigs.length === 0) items.push({ label: 'No analytics or tracking configured', sectionId: 'tracking-analytics' })

  if (!args.seoProfile) items.push({ label: 'SEO has not been assessed yet', sectionId: 'seo' })

  return items
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
