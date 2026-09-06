import type { CompletionStatus } from '@/components/ui/CompletionDot'
import type { DigitalSectionId } from './sections'
import type { DigitalHealthResult, SourceResult } from './digitalHealth'
import type { SocialChannelSnapshot, DigitalAsset } from '@/types'

// Per-section completion dots for the Digital sidebar (see BusinessSidebar's
// useCompletionStatus for the Business equivalent). Unlike Business, none of
// this can be derived synchronously from the `client` row — every Digital
// section lives in its own table — so this is a plain function fed the same
// settled sources DigitalOverview already fetched, rather than a hook.
//
// Social Tracker and Digital Assets get their own completion rule here even
// though neither counts toward the overall Digital Health score (see
// digitalHealth.ts) — a section can be "complete" for sidebar purposes
// without being a health input.

function socialTrackerStatus(snapshots: SourceResult<SocialChannelSnapshot[]>): CompletionStatus {
  if (snapshots.status === 'rejected') return 'unknown'
  const list = snapshots.value ?? []
  if (list.length === 0) return 'empty'
  const RECENT_DAYS = 60
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  const hasRecent = list.some(s => new Date(s.snapshot_date).getTime() >= cutoff)
  return hasRecent ? 'complete' : 'partial'
}

function digitalAssetsStatus(assets: SourceResult<DigitalAsset[]>): CompletionStatus {
  if (assets.status === 'rejected') return 'unknown'
  return (assets.value ?? []).length > 0 ? 'complete' : 'empty'
}

export function computeDigitalCompletion(
  health: DigitalHealthResult,
  extras: {
    socialSnapshots: SourceResult<SocialChannelSnapshot[]>
    digitalAssets: SourceResult<DigitalAsset[]>
  },
): Record<DigitalSectionId, CompletionStatus> {
  const byId: Partial<Record<DigitalSectionId, CompletionStatus>> = {}
  for (const dim of health.dimensions) {
    byId[dim.sectionId as DigitalSectionId] = dim.status
  }

  return {
    overview: 'complete',
    website: byId.website ?? 'empty',
    domains: byId.domains ?? 'empty',
    'social-channels': byId['social-channels'] ?? 'empty',
    'social-tracker': socialTrackerStatus(extras.socialSnapshots),
    'business-listings': byId['business-listings'] ?? 'empty',
    seo: byId.seo ?? 'unknown',
    'tracking-analytics': byId['tracking-analytics'] ?? 'empty',
    'digital-assets': digitalAssetsStatus(extras.digitalAssets),
  }
}
