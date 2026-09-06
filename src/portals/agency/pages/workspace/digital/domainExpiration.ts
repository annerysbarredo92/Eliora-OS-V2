import type { Domain } from '@/types'

// Reusable across DigitalOverview (attention items, KPI hints) and
// DomainsSection (list badges) — one place decides what "expiring soon"
// means so the two surfaces can never disagree.

export type DomainExpirationState = 'expired' | 'expiring_soon' | 'upcoming' | 'healthy' | 'unknown'

export const DOMAIN_EXPIRATION_LABEL: Record<DomainExpirationState, string> = {
  expired: 'Expired',
  expiring_soon: 'Expiring soon',
  upcoming: 'Upcoming',
  healthy: 'Healthy',
  unknown: 'Unknown',
}

/** Date-only, timezone-safe day count from "today" to an ISO date string
 * (YYYY-MM-DD or a full timestamp — only the date portion is used).
 * Comparing at UTC midnight for both sides avoids the day-count drifting
 * by one depending on the caller's local timezone. */
function daysFromToday(dateStr: string): number {
  const target = new Date(dateStr + (dateStr.length <= 10 ? 'T00:00:00Z' : ''))
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.floor((target.getTime() - todayUtc) / (1000 * 60 * 60 * 24))
}

/**
 * expired:        expiration_date < today
 * expiring_soon:  within the next 30 days (inclusive)
 * upcoming:       31-90 days out
 * healthy:        more than 90 days out
 * unknown:        no expiration_date on file — deliberately NOT "healthy";
 *                 missing data must never read as safe.
 */
export function domainExpirationState(domain: Pick<Domain, 'expiration_date'>): DomainExpirationState {
  if (!domain.expiration_date) return 'unknown'
  const days = daysFromToday(domain.expiration_date)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring_soon'
  if (days <= 90) return 'upcoming'
  return 'healthy'
}

export function domainDaysUntilExpiration(domain: Pick<Domain, 'expiration_date'>): number | null {
  if (!domain.expiration_date) return null
  return daysFromToday(domain.expiration_date)
}
