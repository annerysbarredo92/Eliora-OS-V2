import type { Client } from '@/types'

/* ── Business Health (profile completeness) ─────────────── */

export type DimensionStatus = 'complete' | 'partial' | 'empty'

export interface HealthDimension {
  id: string
  label: string
  score: number      // 0–100
  max: number        // always 100
  status: DimensionStatus
  sectionId: string  // maps to ?section=XXX URL param
  tip: string | null // what's missing
}

export interface BusinessHealthResult {
  score: number                   // 0–100, weighted average
  dimensions: HealthDimension[]
}

function pct(filled: number, total: number): number {
  return total === 0 ? 0 : Math.round((filled / total) * 100)
}

function dimStatus(score: number): DimensionStatus {
  if (score === 100) return 'complete'
  if (score > 0) return 'partial'
  return 'empty'
}

/* ── JSONB domain helpers ────────────────────────────────── */

function hasVoice(dd: Record<string, unknown>): boolean {
  const v = dd.brand_voice
  if (!v) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'object' && !Array.isArray(v)) {
    const r = v as Record<string, unknown>
    return typeof r.voice_descriptor === 'string' && r.voice_descriptor.trim().length > 0
  }
  return false
}

function hasDiscoveryBusiness(dd: Record<string, unknown>): boolean {
  const r = dd.discovery_business as Record<string, unknown> | undefined
  if (!r) return false
  return Object.values(r).some(v => typeof v === 'string' && v.trim().length > 0)
}

function hasDiscoveryAudience(dd: Record<string, unknown>): boolean {
  const r = dd.discovery_audience as Record<string, unknown> | undefined
  if (!r) return false
  return Object.values(r).some(v => typeof v === 'string' && v.trim().length > 0)
}

function hasDiscoveryMarketing(dd: Record<string, unknown>): boolean {
  const r = dd.discovery_marketing as Record<string, unknown> | undefined
  if (!r) return false
  return Object.values(r).some(v => typeof v === 'string' && v.trim().length > 0)
}


// Optional account data passed from BusinessOverview after async load.
// If omitted, the Account dimension is excluded from the health score.
// A client without a retainer is NOT penalised — retainer is a bonus signal.
export interface AccountDataForHealth {
  proposalCount: number
  contractCount: number
  signedContractCount: number
  invoiceCount: number
  totalCollectedCents: number
  hasActiveRetainer: boolean
  // Dynamic denominator: if retainerCount > 0 the client has used retainers, so
  // active retainer becomes a required signal. If 0, score from 3 project signals only.
  retainerCount: number
}

export function computeBusinessHealth(client: Client, accountData?: AccountDataForHealth): BusinessHealthResult {
  const d = client.discovery_data ?? {}

  /* 1. Company Identity */
  const identityFields = [
    !!client.business_name,
    !!client.industry,
    !!client.sub_industry,
    !!client.website,
    !!client.business_email || !!client.business_phone,
    !!client.location,
    !!client.timezone,
  ]
  const identityScore = pct(identityFields.filter(Boolean).length, identityFields.length)
  const identityTips = [
    !client.industry && 'industry',
    !client.sub_industry && 'sub-industry',
    !client.website && 'website',
    (!client.business_email && !client.business_phone) && 'contact email or phone',
    !client.location && 'location',
    !client.timezone && 'timezone',
  ].filter(Boolean) as string[]

  /* 2. Business Context */
  const contextFields = [
    !!client.company_description,
    !!(d.founded_year),
    !!(d.employee_count),
    !!(d.business_model),
    !!(d.geographic_reach),
    !!(d.service_area),
  ]
  const contextScore = pct(contextFields.filter(Boolean).length, contextFields.length)
  const contextTips = [
    !client.company_description && 'company description',
    !d.founded_year && 'founding year',
    !d.employee_count && 'team size',
    !d.business_model && 'business model',
  ].filter(Boolean) as string[]

  /* 3. Social Presence */
  const socialUrls: Record<string, string> = (d.social_urls as Record<string, string>) ?? {}
  const socialPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter', 'youtube', 'tiktok']
  const socialFilled = socialPlatforms.filter(p => !!socialUrls[p]).length
  const socialScore = pct(socialFilled, socialPlatforms.length)

  /* 4. Contacts */
  const contacts = client.client_contacts ?? []
  const hasPrimary = contacts.some(c => c.is_primary)
  const hasMultiple = contacts.length >= 2
  const contactScore = pct(
    (hasPrimary ? 2 : contacts.length > 0 ? 1 : 0) + (hasMultiple ? 1 : 0),
    3,
  )
  const contactTips = [
    contacts.length === 0 && 'add a contact',
    !hasPrimary && contacts.length > 0 && 'set a primary contact',
    !hasMultiple && 'add additional contacts',
  ].filter(Boolean) as string[]

  /* 5. Discovery Data (now uses Wave 3 structured domains) */
  const discoveryFields = [
    !!(d.business_hours),
    hasDiscoveryBusiness(d),
    hasDiscoveryAudience(d),
    hasDiscoveryMarketing(d),
  ]
  const discoveryScore = pct(discoveryFields.filter(Boolean).length, discoveryFields.length)
  const discoveryTips = [
    !d.business_hours && 'business hours',
    !hasDiscoveryBusiness(d) && 'business understanding',
    !hasDiscoveryAudience(d) && 'audience understanding',
    !hasDiscoveryMarketing(d) && 'marketing foundation',
  ].filter(Boolean) as string[]

  const dimensions: HealthDimension[] = [
    {
      id: 'identity',
      label: 'Company Identity',
      score: identityScore,
      max: 100,
      status: dimStatus(identityScore),
      sectionId: 'company',
      tip: identityTips.length ? `Missing: ${identityTips.slice(0, 2).join(', ')}` : null,
    },
    {
      id: 'context',
      label: 'Business Context',
      score: contextScore,
      max: 100,
      status: dimStatus(contextScore),
      sectionId: 'company',
      tip: contextTips.length ? `Missing: ${contextTips.slice(0, 2).join(', ')}` : null,
    },
    {
      id: 'social',
      label: 'Social Presence',
      score: socialScore,
      max: 100,
      status: dimStatus(socialScore),
      sectionId: 'company',
      tip: socialScore < 100 ? `${socialPlatforms.length - socialFilled} platforms missing` : null,
    },
    {
      id: 'contacts',
      label: 'Contacts',
      score: contactScore,
      max: 100,
      status: dimStatus(contactScore),
      sectionId: 'contacts',
      tip: contactTips.length ? contactTips[0] : null,
    },
    {
      id: 'discovery',
      label: 'Discovery Data',
      score: discoveryScore,
      max: 100,
      status: dimStatus(discoveryScore),
      sectionId: 'discovery',
      tip: discoveryTips.length ? `Missing: ${discoveryTips.slice(0, 2).join(', ')}` : null,
    },
  ]

  // Account dimension — only added when async data is available from BusinessOverview.
  // Dynamic denominator: if client has used retainers (retainerCount > 0), active retainer
  // is a 4th signal (denominator = 4). Project-based clients (retainerCount === 0) are
  // scored on 3 signals only (denominator = 3) so they can reach 100% without a retainer.
  // A failed retainer request (retainerCount stays 0) also avoids penalising the score.
  if (accountData) {
    const hasEverUsedRetainer = accountData.retainerCount > 0
    const accountChecks = [
      accountData.proposalCount > 0,
      accountData.signedContractCount > 0 || accountData.contractCount > 0,
      accountData.totalCollectedCents > 0,
      ...(hasEverUsedRetainer ? [accountData.hasActiveRetainer] : []),
    ]
    const denominator = hasEverUsedRetainer ? 4 : 3
    const accountScore = pct(accountChecks.filter(Boolean).length, denominator)
    const accountTips = [
      !accountChecks[0] && 'no proposals on file',
      !accountChecks[1] && 'no contracts on file',
      !accountChecks[2] && 'no payments recorded',
    ].filter(Boolean) as string[]

    dimensions.push({
      id: 'account',
      label: 'Account',
      score: accountScore,
      max: 100,
      status: dimStatus(accountScore),
      sectionId: 'proposals',
      tip: accountTips.length ? `Missing: ${accountTips.slice(0, 2).join(', ')}` : null,
    })
  }

  // Weights: identity 28, context 18, social 14, contacts 18, discovery 14, account 8
  // (account weight only applies when the dimension is present)
  const baseWeights = [0.30, 0.20, 0.15, 0.20, 0.15]
  const accountWeight = accountData ? 0.08 : 0
  const scale = 1 - accountWeight
  const score = Math.round(
    dimensions.slice(0, 5).reduce((sum, dim, i) => sum + dim.score * baseWeights[i] * scale, 0) +
    (accountData ? (dimensions[5]?.score ?? 0) * accountWeight : 0)
  )

  return { score, dimensions }
}

/* ── AI Readiness ──────────────────────────────────────── */

export interface AISignal {
  id: string
  label: string
  complete: boolean
  sectionId: string
}

export interface AIReadinessResult {
  score: number       // 0–100 (percent of signals complete)
  complete: number
  total: number
  signals: AISignal[]
}

export function computeAIReadiness(client: Client): AIReadinessResult {
  const d = client.discovery_data ?? {}
  const contacts = client.client_contacts ?? []

  const signals: AISignal[] = [
    /* Wave 2 signals — Company & Contacts */
    {
      id: 'description',
      label: 'Company description',
      complete: !!client.company_description,
      sectionId: 'company',
    },
    {
      id: 'industry',
      label: 'Industry & sub-industry',
      complete: !!client.industry && !!client.sub_industry,
      sectionId: 'company',
    },
    {
      id: 'business_model',
      label: 'Business model',
      complete: !!(d.business_model),
      sectionId: 'company',
    },
    {
      id: 'social',
      label: 'Social media profiles',
      complete: !!(d.social_urls && Object.keys(d.social_urls as object).length > 0),
      sectionId: 'company',
    },
    {
      id: 'hours',
      label: 'Business hours',
      complete: !!(d.business_hours),
      sectionId: 'company',
    },
    {
      id: 'contact',
      label: 'Primary contact',
      complete: contacts.some(c => c.is_primary),
      sectionId: 'contacts',
    },
    /* Wave 3 signals — Strategy sections */
    {
      id: 'brand_voice',
      label: 'Brand voice',
      complete: hasVoice(d),
      sectionId: 'brand',
    },
    {
      id: 'target_audience',
      label: 'Target audience',
      complete: hasDiscoveryAudience(d),
      sectionId: 'discovery',
    },
    {
      id: 'products_services',
      label: 'Products & services',
      complete: false, // resolved async from useProducts; placeholder — caller may override
      sectionId: 'products',
    },
    {
      id: 'goals',
      label: 'Active goals',
      complete: false, // resolved async from useGoals; placeholder — caller may override
      sectionId: 'goals',
    },
    {
      id: 'market_context',
      label: 'Market context (SWOT or competitors)',
      complete: (() => {
        const swot = d.market_swot as Record<string, unknown> | undefined
        const hasSwot = swot && (
          (Array.isArray(swot.strengths) && swot.strengths.length > 0) ||
          (Array.isArray(swot.opportunities) && swot.opportunities.length > 0)
        )
        return !!hasSwot
      })(),
      sectionId: 'market-intelligence',
    },
  ]

  const complete = signals.filter(s => s.complete).length
  const total = signals.length
  const score = Math.round((complete / total) * 100)

  return { score, complete, total, signals }
}

/* ── AI Readiness with async product/goal counts ─────────── */
// For use in BusinessOverview where we have pre-loaded counts.
export function patchAIReadinessWithCounts(
  result: AIReadinessResult,
  productCount: number,
  goalCount: number,
): AIReadinessResult {
  const signals = result.signals.map(s => {
    if (s.id === 'products_services') return { ...s, complete: productCount > 0 }
    if (s.id === 'goals')             return { ...s, complete: goalCount > 0 }
    return s
  })
  const complete = signals.filter(s => s.complete).length
  const score    = Math.round((complete / signals.length) * 100)
  return { ...result, signals, complete, score }
}
