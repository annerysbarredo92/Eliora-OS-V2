import type { ContentType, ContentPlatform, ContentStatus } from '@/types'

export const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'static_post', label: 'Static Post' },
  { value: 'carousel',    label: 'Carousel' },
  { value: 'reel',        label: 'Reel' },
  { value: 'story',       label: 'Story' },
  { value: 'video',       label: 'Video' },
  { value: 'blog',        label: 'Blog' },
  { value: 'email',       label: 'Email' },
  { value: 'custom',      label: 'Custom' },
]

export const PLATFORM_OPTIONS: { value: ContentPlatform; label: string }[] = [
  { value: 'instagram',       label: 'Instagram' },
  { value: 'facebook',        label: 'Facebook' },
  { value: 'tiktok',          label: 'TikTok' },
  { value: 'linkedin',        label: 'LinkedIn' },
  { value: 'pinterest',       label: 'Pinterest' },
  { value: 'youtube',         label: 'YouTube' },
  { value: 'google_business', label: 'Google Business' },
  { value: 'custom',          label: 'Custom' },
]

export const STATUS_META: Record<ContentStatus, { label: string; badge: 'default' | 'info' | 'success' | 'warning' | 'danger' | 'brand' }> = {
  draft:              { label: 'Draft',              badge: 'default' },
  internal_review:    { label: 'Internal Review',    badge: 'info' },
  client_review:      { label: 'Client Review',      badge: 'brand' },
  approved:           { label: 'Approved',           badge: 'success' },
  revision_requested: { label: 'Revision Requested', badge: 'warning' },
  rejected:           { label: 'Rejected',           badge: 'danger' },
  scheduled:          { label: 'Scheduled',          badge: 'info' },
  published:          { label: 'Published',          badge: 'success' },
  archived:           { label: 'Archived',           badge: 'default' },
}

export function typeLabel(t: ContentType) { return CONTENT_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t }
export function platformLabel(p: ContentPlatform) { return PLATFORM_OPTIONS.find(o => o.value === p)?.label ?? p }

/** Statuses an agency can move content to directly (besides client review). */
export const AGENCY_STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: 'draft',           label: 'Draft' },
  { value: 'internal_review', label: 'Internal Review' },
  { value: 'scheduled',       label: 'Scheduled' },
  { value: 'published',       label: 'Published' },
  { value: 'archived',        label: 'Archived' },
]

/** Content the client needs to act on. */
export function isPendingClientReview(status: ContentStatus): boolean {
  return status === 'client_review'
}
