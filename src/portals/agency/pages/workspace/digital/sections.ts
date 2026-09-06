// Locked Digital Workspace structure (Wave 1 — do not add, remove, or
// reorder sections without revisiting the product spec).
export type DigitalSectionId =
  | 'overview'
  | 'website'
  | 'domains'
  | 'social-channels'
  | 'social-tracker'
  | 'business-listings'
  | 'seo'
  | 'tracking-analytics'
  | 'digital-assets'

export type DigitalSectionGroup = 'root' | 'presence' | 'infrastructure'

export interface DigitalSectionDef {
  id: DigitalSectionId
  label: string
  group: DigitalSectionGroup
  ariaLabel: string
  description: string
  implemented: boolean
}

export const DIGITAL_SECTIONS: DigitalSectionDef[] = [
  {
    id: 'overview',
    label: 'Overview',
    group: 'root',
    ariaLabel: 'Digital overview',
    description: 'The state of this client\'s owned digital presence — websites, domains, social channels, listings, and infrastructure.',
    implemented: true,
  },
  {
    id: 'website',
    label: 'Website',
    group: 'presence',
    ariaLabel: 'Websites',
    description: 'This client\'s owned websites, platform, hosting, and which one is primary.',
    implemented: false,
  },
  {
    id: 'domains',
    label: 'Domains',
    group: 'presence',
    ariaLabel: 'Domains',
    description: 'Domains this client owns — registrar, DNS provider, renewal, and SSL status.',
    implemented: false,
  },
  {
    id: 'social-channels',
    label: 'Social Channels',
    group: 'presence',
    ariaLabel: 'Social channels',
    description: 'This client\'s social media accounts — ownership, access, and connection status.',
    implemented: false,
  },
  {
    id: 'social-tracker',
    label: 'Social Tracker',
    group: 'presence',
    ariaLabel: 'Social tracker',
    description: 'Historical growth metrics for this client\'s social channels — followers, reach, and engagement over time.',
    implemented: false,
  },
  {
    id: 'business-listings',
    label: 'Business Listings',
    group: 'presence',
    ariaLabel: 'Business listings',
    description: 'This client\'s directory presence — Google Business Profile, Apple Business Connect, Bing Places, Yelp, and custom listings.',
    implemented: false,
  },
  {
    id: 'seo',
    label: 'SEO',
    group: 'infrastructure',
    ariaLabel: 'SEO',
    description: 'Technical SEO infrastructure and baseline visibility — indexing, sitemap, robots.txt, and Search Console.',
    implemented: false,
  },
  {
    id: 'tracking-analytics',
    label: 'Tracking & Analytics',
    group: 'infrastructure',
    ariaLabel: 'Tracking and analytics',
    description: 'Analytics and tracking systems configured for this client — GA4, GTM, Meta Pixel, and more.',
    implemented: false,
  },
  {
    id: 'digital-assets',
    label: 'Digital Assets',
    group: 'infrastructure',
    ariaLabel: 'Digital assets',
    description: 'Existing Files associated with this client\'s digital properties — favicons, app icons, social assets, and technical documents.',
    implemented: false,
  },
]

export const VALID_DIGITAL_SECTION_IDS = new Set<string>(DIGITAL_SECTIONS.map(s => s.id))

export const DEFAULT_DIGITAL_SECTION: DigitalSectionId = 'overview'

export function resolveDigitalSectionId(raw: string | null): DigitalSectionId {
  if (!raw || !VALID_DIGITAL_SECTION_IDS.has(raw)) return DEFAULT_DIGITAL_SECTION
  return raw as DigitalSectionId
}

export const DIGITAL_SECTION_GROUP_LABELS: Record<DigitalSectionGroup, string> = {
  root:           '',
  presence:       'PRESENCE',
  infrastructure: 'INFRASTRUCTURE',
}
