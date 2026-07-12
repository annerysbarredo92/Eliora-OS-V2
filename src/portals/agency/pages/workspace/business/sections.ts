export type SectionId =
  | 'overview'
  | 'company'
  | 'contacts'
  | 'brand'
  | 'discovery'
  | 'products'
  | 'goals'
  | 'market-intelligence'
  | 'proposals'
  | 'contracts'
  | 'invoices'
  | 'payments'
  | 'retainers'

export type SectionGroup = 'root' | 'identity' | 'strategy' | 'account'

export interface SectionDef {
  id: SectionId
  label: string
  group: SectionGroup
  ariaLabel: string
  description: string
  implemented: boolean
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'overview',
    label: 'Overview',
    group: 'root',
    ariaLabel: 'Business overview',
    description: 'A comprehensive snapshot of this client\'s business health, recent activity, and key metrics.',
    implemented: true,
  },
  {
    id: 'company',
    label: 'Company',
    group: 'identity',
    ariaLabel: 'Company information',
    description: 'Manage company details, business information, and social media presence.',
    implemented: true,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    group: 'identity',
    ariaLabel: 'Client contacts',
    description: 'Manage all contacts associated with this client account.',
    implemented: true,
  },
  {
    id: 'brand',
    label: 'Brand Center',
    group: 'identity',
    ariaLabel: 'Brand center',
    description: 'Manage this client\'s visual identity, brand voice, messaging guidelines, and approved assets.',
    implemented: true,
  },
  {
    id: 'discovery',
    label: 'Discovery',
    group: 'strategy',
    ariaLabel: 'Discovery data',
    description: 'Capture discovery data, meeting notes, strategic insights, and AI-powered analysis for this client.',
    implemented: true,
  },
  {
    id: 'products',
    label: 'Products & Services',
    group: 'strategy',
    ariaLabel: 'Products and services',
    description: 'Document what this client sells, including pricing, benefits, target audiences, and FAQs.',
    implemented: true,
  },
  {
    id: 'goals',
    label: 'Goals & KPIs',
    group: 'strategy',
    ariaLabel: 'Goals and KPIs',
    description: 'Set and track strategic goals and KPIs to measure client progress and business outcomes.',
    implemented: true,
  },
  {
    id: 'market-intelligence',
    label: 'Market Intelligence',
    group: 'strategy',
    ariaLabel: 'Market intelligence',
    description: 'Map competitive landscape, capture SWOT analysis, and track market positioning.',
    implemented: true,
  },
  {
    id: 'proposals',
    label: 'Proposals',
    group: 'account',
    ariaLabel: 'Proposals',
    description: 'Create, send, and track proposals for this client\'s projects and engagements.',
    implemented: false,
  },
  {
    id: 'contracts',
    label: 'Contracts',
    group: 'account',
    ariaLabel: 'Contracts',
    description: 'Manage service agreements and signed contracts for this client relationship.',
    implemented: false,
  },
  {
    id: 'invoices',
    label: 'Invoices',
    group: 'account',
    ariaLabel: 'Invoices',
    description: 'Create and manage invoices, track billing, and monitor payment status.',
    implemented: false,
  },
  {
    id: 'payments',
    label: 'Payments',
    group: 'account',
    ariaLabel: 'Payment history',
    description: 'View and record all payments received from this client.',
    implemented: false,
  },
  {
    id: 'retainers',
    label: 'Retainers',
    group: 'account',
    ariaLabel: 'Retainer agreements',
    description: 'Set up and manage ongoing retainer agreements with scheduled billing.',
    implemented: false,
  },
]

export const VALID_SECTION_IDS = new Set<string>(SECTIONS.map(s => s.id))

export const DEFAULT_SECTION: SectionId = 'overview'

export function resolveSectionId(raw: string | null): SectionId {
  if (!raw || !VALID_SECTION_IDS.has(raw)) return DEFAULT_SECTION
  return raw as SectionId
}

export const SECTION_GROUP_LABELS: Record<SectionGroup, string> = {
  root:     '',
  identity: 'IDENTITY',
  strategy: 'STRATEGY',
  account:  'ACCOUNT',
}
