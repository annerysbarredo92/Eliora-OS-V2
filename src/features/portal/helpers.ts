export const ONBOARDING_SECTIONS = [
  { key: 'company_info',       label: 'Company Information' },
  { key: 'primary_contact',    label: 'Primary Contact' },
  { key: 'brand_info',         label: 'Brand Information' },
  { key: 'social_accounts',    label: 'Social Media Accounts' },
  { key: 'business_goals',     label: 'Business Goals' },
  { key: 'communication_prefs',label: 'Communication Preferences' },
  { key: 'approval_prefs',     label: 'Approval Preferences' },
] as const

export type SectionKey = typeof ONBOARDING_SECTIONS[number]['key']

export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x'] as const

export const COMM_CHANNELS = [
  { value: 'email',  label: 'Email' },
  { value: 'phone',  label: 'Phone' },
  { value: 'portal', label: 'Portal messages' },
]

export const COMM_FREQUENCIES = [
  { value: 'daily',     label: 'Daily' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-weekly' },
  { value: 'monthly',   label: 'Monthly' },
]

export const APPROVAL_WORKFLOWS = [
  { value: 'single', label: 'One approver' },
  { value: 'team',   label: 'Team review' },
  { value: 'auto',   label: 'Auto-approve' },
]

export const APPROVAL_TURNAROUNDS = [
  { value: '24h', label: 'Within 24 hours' },
  { value: '48h', label: 'Within 48 hours' },
  { value: '72h', label: 'Within 72 hours' },
  { value: 'week', label: 'Within a week' },
]

export function pctFromSections(sections: Record<string, boolean>): number {
  const total = ONBOARDING_SECTIONS.length
  const done = ONBOARDING_SECTIONS.filter(s => sections[s.key]).length
  return Math.round((done / total) * 100)
}
