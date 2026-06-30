import type { Client, ClientContact, ClientStatus, ClientHealth } from '@/types'

/** Resolve the primary contact from an embedded client_contacts array. */
export function primaryContact(client: Client): ClientContact | null {
  const contacts = client.client_contacts ?? []
  return contacts.find(c => c.is_primary) ?? contacts[0] ?? null
}

export function contactName(c: ClientContact | null): string {
  if (!c) return '—'
  const name = `${c.first_name} ${c.last_name}`.trim()
  return name || '—'
}

export const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'active',     label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'paused',     label: 'Paused' },
  { value: 'lead',       label: 'Lead' },
  { value: 'archived',   label: 'Archived' },
]

export const STATUS_BADGE: Record<ClientStatus, 'success' | 'info' | 'warning' | 'default' | 'brand'> = {
  active:     'success',
  onboarding: 'info',
  paused:     'warning',
  lead:       'brand',
  archived:   'default',
}

export const HEALTH_LABEL: Record<ClientHealth, string> = {
  healthy:  'Healthy',
  at_risk:  'At risk',
  critical: 'Critical',
  unknown:  'Not set',
}

export const HEALTH_BADGE: Record<ClientHealth, 'success' | 'warning' | 'danger' | 'default'> = {
  healthy:  'success',
  at_risk:  'warning',
  critical: 'danger',
  unknown:  'default',
}

export function statusLabel(status: ClientStatus): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
}

/** Relative "last activity" string, e.g. "3h ago", "Just now", "—". */
export function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
