import type { BillingType, BillingFrequency, SetupStepStatus } from '@/types'

export const SERVICE_CATEGORIES = [
  'Content Creation',
  'Social Media Management',
  'Reporting',
  'Paid Advertising',
  'Brand Strategy',
  'Photography',
  'Video Production',
  'Consulting',
  'Other',
] as const

export const BILLING_TYPE_OPTIONS: { value: BillingType; label: string }[] = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one_time',  label: 'One-time' },
  { value: 'custom',    label: 'Custom' },
]

export const BILLING_FREQ_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual',    label: 'Annual' },
  { value: 'one_time',  label: 'One-time' },
  { value: 'custom',    label: 'Custom' },
]

export function billingLabel(v: BillingType | BillingFrequency): string {
  const all = [...BILLING_TYPE_OPTIONS, ...BILLING_FREQ_OPTIONS]
  return all.find(o => o.value === v)?.label ?? v
}

/** Money is stored as integer cents. */
export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

/** Parse a "$1,200.50" / "1200" string into integer cents. */
export function toCents(input: string): number {
  const n = Number(String(input).replace(/[^0-9.]/g, ''))
  if (!isFinite(n)) return 0
  return Math.round(n * 100)
}

export const STEP_STATUS_BADGE: Record<SetupStepStatus, 'success' | 'info' | 'warning' | 'default'> = {
  completed:   'success',
  in_progress: 'info',
  skipped:     'warning',
  not_started: 'default',
}

export const STEP_STATUS_LABEL: Record<SetupStepStatus, string> = {
  completed:   'Complete',
  in_progress: 'In progress',
  skipped:     'Skipped',
  not_started: 'Not started',
}
