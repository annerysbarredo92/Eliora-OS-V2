import type { CompletionStatus } from '@/components/ui/CompletionDot'
import type { Client } from '@/types'
import type { SectionId } from './sections'

export function useCompletionStatus(client: Client): Record<SectionId, CompletionStatus> {
  const dd = (client.discovery_data ?? {}) as Record<string, unknown>
  const str = (k: string) => typeof dd[k] === 'string' && (dd[k] as string).trim()

  // Company: industry + website + (business_email OR business_phone) + company_description
  const companyChecks = [
    !!client.industry,
    !!client.website,
    !!(client.business_email || client.business_phone),
    !!client.company_description,
  ]
  const companyFilled = companyChecks.filter(Boolean).length
  const company: CompletionStatus =
    companyFilled >= 3 ? 'complete' : companyFilled >= 1 ? 'partial' : 'empty'

  // Contacts: has contacts + has primary
  const contactList = client.client_contacts ?? []
  const hasPrimary  = contactList.some(c => c.is_primary)
  const contacts: CompletionStatus =
    contactList.length > 0 && hasPrimary ? 'complete'
    : contactList.length > 0 ? 'partial'
    : 'empty'

  // Brand: check discovery_data for brand fields
  const brandFields = ['brand_voice', 'brand_mission', 'current_tagline', 'brand_colors']
  const brandFilled = brandFields.filter(k => str(k)).length
  const brand: CompletionStatus =
    brandFilled >= 3 ? 'complete' : brandFilled >= 1 ? 'partial' : 'empty'

  return {
    overview:              'complete',
    company,
    contacts,
    brand,
    // Wave 3+ placeholders
    discovery:             'empty',
    products:              'empty',
    goals:                 'empty',
    'market-intelligence': 'empty',
    proposals:             'empty',
    contracts:             'empty',
    invoices:              'empty',
    payments:              'empty',
    retainers:             'empty',
  }
}
