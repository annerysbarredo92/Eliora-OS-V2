import type { SocialChannelSnapshot } from '@/types'

// Isolated from the UI so both SocialTrackerSection (per-channel detail)
// and any future Overview signal can share the exact same comparison
// rules — in particular, the "never fabricate 0% growth" guard.

export interface MetricChange {
  current: number | null
  previous: number | null
  /** current - previous. Null whenever either side is null. */
  delta: number | null
  /** (delta / previous) * 100. Null when there is no usable previous value
   * to divide by (missing snapshot, or previous itself is null) OR when
   * previous is exactly 0 — a 0 → N change is a real, infinite-percent
   * jump, not a number worth presenting as a percentage. */
  percent: number | null
  /** True only when both values are real numbers, so the caller can show
   * a comparison at all. False must render as "No comparison", never 0%. */
  comparable: boolean
}

export function computeMetricChange(current: number | null | undefined, previous: number | null | undefined): MetricChange {
  const c = current ?? null
  const p = previous ?? null
  if (c === null || p === null) {
    return { current: c, previous: p, delta: null, percent: null, comparable: false }
  }
  const delta = c - p
  const percent = p === 0 ? null : (delta / p) * 100
  return { current: c, previous: p, delta, percent, comparable: true }
}

/**
 * `snapshots` must already be sorted newest-first (see
 * listSnapshotsByChannel in features/digital/api.ts). Returns the latest
 * snapshot and, separately, the one immediately before it — null when
 * fewer than 2 snapshots exist. Never invents a synthetic "previous" row.
 */
export function latestAndPrevious(
  snapshots: SocialChannelSnapshot[],
): [SocialChannelSnapshot | null, SocialChannelSnapshot | null] {
  return [snapshots[0] ?? null, snapshots[1] ?? null]
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()
}

export function formatPercent(percent: number | null): string {
  if (percent === null) return 'No comparison'
  const rounded = Math.round(percent * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}
