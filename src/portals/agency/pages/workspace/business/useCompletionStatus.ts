import type { CompletionStatus } from '@/components/ui/CompletionDot'
import type { Client } from '@/types'
import type { SectionId } from './sections'

// Account completion data passed in from BusinessOverview after async load.
// 'empty' means the section has no records; 'partial' means some; 'complete' means threshold met.
// 'failed' is never used — failed requests leave the dot at 'empty', not misrepresented.
export interface AccountCompletionData {
  proposals: CompletionStatus
  contracts: CompletionStatus
  invoices: CompletionStatus
  payments: CompletionStatus
  retainers: CompletionStatus
}

/* ── JSONB domain helpers ────────────────────────────────── */

function hasVoiceDomain(dd: Record<string, unknown>): boolean {
  const v = dd.brand_voice
  if (!v) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'object' && !Array.isArray(v)) {
    const r = v as Record<string, unknown>
    return typeof r.voice_descriptor === 'string' && r.voice_descriptor.trim().length > 0
  }
  return false
}

function countDomainFields(domain: Record<string, unknown> | undefined): number {
  if (!domain) return 0
  return Object.values(domain).filter(v => {
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    return !!v
  }).length
}

export function useCompletionStatus(
  client: Client,
  accountData?: AccountCompletionData,
): Record<SectionId, CompletionStatus> {
  const dd = (client.discovery_data ?? {}) as Record<string, unknown>

  /* ── Company ──────────────────────────────────────────── */
  const companyChecks = [
    !!client.industry,
    !!client.website,
    !!(client.business_email || client.business_phone),
    !!client.company_description,
  ]
  const companyFilled = companyChecks.filter(Boolean).length
  const company: CompletionStatus =
    companyFilled >= 3 ? 'complete' : companyFilled >= 1 ? 'partial' : 'empty'

  /* ── Contacts ─────────────────────────────────────────── */
  const contactList = client.client_contacts ?? []
  const hasPrimary  = contactList.some(c => c.is_primary)
  const contacts: CompletionStatus =
    contactList.length > 0 && hasPrimary ? 'complete'
    : contactList.length > 0 ? 'partial'
    : 'empty'

  /* ── Brand Center ─────────────────────────────────────── */
  // complete: all three domains have data
  // partial: at least one domain has data
  const visual   = dd.brand_visual   as Record<string, unknown> | undefined
  const strategy = dd.brand_strategy as Record<string, unknown> | undefined
  const hasVisual   = (Array.isArray(visual?.colors) && visual.colors.length > 0) || (Array.isArray(visual?.fonts) && visual.fonts.length > 0)
  const hasVoice    = hasVoiceDomain(dd)
  const hasStrategy = (typeof strategy?.mission === 'string' && strategy.mission.trim().length > 0) || (typeof strategy?.uvp === 'string' && strategy.uvp.trim().length > 0)

  const brandCount  = [hasVisual, hasVoice, hasStrategy].filter(Boolean).length
  const brand: CompletionStatus =
    brandCount === 3 ? 'complete' : brandCount >= 1 ? 'partial' : 'empty'

  /* ── Discovery ────────────────────────────────────────── */
  const bizFields = countDomainFields(dd.discovery_business as Record<string, unknown> | undefined)
  const audFields = countDomainFields(dd.discovery_audience as Record<string, unknown> | undefined)
  const mktFields = countDomainFields(dd.discovery_marketing as Record<string, unknown> | undefined)
  const discoveryTotal = bizFields + audFields + mktFields
  const discovery: CompletionStatus =
    discoveryTotal >= 12 ? 'complete' : discoveryTotal >= 3 ? 'partial' : 'empty'

  /* ── Products & Services ──────────────────────────────── */
  // Cannot check async data from here — use presence of any product data hint in dd.
  // BusinessOverview will have the full count; here we use a conservative placeholder
  // that shows 'empty' until the user navigates to the section.
  // This is acceptable: the completion dot on the sidebar will show empty until
  // the section has been visited and data is present in discovery_data.
  // A future enhancement: store product_count in discovery_data on write.
  const productCount = typeof dd._product_count === 'number' ? dd._product_count : 0
  const products: CompletionStatus =
    productCount > 5 ? 'complete' : productCount > 0 ? 'partial' : 'empty'

  /* ── Goals & KPIs ─────────────────────────────────────── */
  const goalCount = typeof dd._goal_count === 'number' ? dd._goal_count : 0
  const goals: CompletionStatus =
    goalCount >= 3 ? 'complete' : goalCount >= 1 ? 'partial' : 'empty'

  /* ── Market Intelligence ──────────────────────────────── */
  const swot = dd.market_swot as Record<string, unknown> | undefined
  const hasSwot = swot && (
    (Array.isArray(swot.strengths)     && swot.strengths.length     > 0) ||
    (Array.isArray(swot.weaknesses)    && swot.weaknesses.length    > 0) ||
    (Array.isArray(swot.opportunities) && swot.opportunities.length > 0) ||
    (Array.isArray(swot.threats)       && swot.threats.length       > 0)
  )
  const position = dd.market_position as Record<string, unknown> | undefined
  const hasPosition = typeof position?.positioning_statement === 'string' && position.positioning_statement.trim().length > 0
  const competitorCount = typeof dd._competitor_count === 'number' ? dd._competitor_count : 0

  const marketSignals = [!!hasSwot, !!hasPosition, competitorCount > 0]
  const marketFilled  = marketSignals.filter(Boolean).length
  const marketIntelligence: CompletionStatus =
    marketFilled === 3 ? 'complete' : marketFilled >= 1 ? 'partial' : 'empty'

  return {
    overview:              'complete',
    company,
    contacts,
    brand,
    discovery,
    products,
    goals,
    'market-intelligence': marketIntelligence,
    // Account sections: use async data from BusinessOverview when available.
    // Rules (per section):
    //   proposals: empty=0, partial=1+ (non-accepted), complete=1+ accepted
    //   contracts: empty=0, partial=1+ (non-signed), complete=1+ signed
    //   invoices:  empty=0, partial=1+ sent/viewed, complete=1+ paid
    //   payments:  empty=no paid, partial=some outstanding, complete=all invoices paid
    //   retainers: empty=0, partial=draft/paused/ending, complete=active
    // Failed requests leave the dot at 'empty' — never misrepresent error as content.
    proposals: accountData?.proposals ?? 'empty',
    contracts: accountData?.contracts ?? 'empty',
    invoices:  accountData?.invoices  ?? 'empty',
    payments:  accountData?.payments  ?? 'empty',
    retainers: accountData?.retainers ?? 'empty',
  }
}
