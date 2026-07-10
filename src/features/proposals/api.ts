import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Proposal, ProposalSection, ProposalLineItem, ProposalStatus, Service, Package } from '@/types'

interface Ctx { agencyId: string; actorId: string }

const DEFAULT_SECTIONS = [
  { kind: 'intro', title: 'Introduction' },
  { kind: 'scope', title: 'Scope of Work' },
  { kind: 'services', title: 'Services' },
  { kind: 'pricing', title: 'Pricing Summary' },
  { kind: 'timeline', title: 'Timeline' },
  { kind: 'terms', title: 'Terms' },
  { kind: 'next_steps', title: 'Next Steps' },
]

export async function listProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase.from('proposals').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listProposals:', error.message); throw new Error(error.message) }
  return (data ?? []) as Proposal[]
}

export async function listProposalsByClient(clientId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) { console.error('listProposalsByClient:', error.message); return [] }
  return (data ?? []) as Proposal[]
}
export async function getProposal(id: string): Promise<{ proposal: Proposal | null; sections: ProposalSection[]; items: ProposalLineItem[] }> {
  const [{ data: p }, { data: s }, { data: i }] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', id).maybeSingle(),
    supabase.from('proposal_sections').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposal_line_items').select('*').eq('proposal_id', id).order('sort_order'),
  ])
  return { proposal: (p as Proposal) ?? null, sections: (s ?? []) as ProposalSection[], items: (i ?? []) as ProposalLineItem[] }
}

export async function createProposal(opts: { title: string; lead_id?: string | null; client_id?: string | null }, ctx: Ctx): Promise<Proposal> {
  const { data, error } = await supabase.from('proposals').insert({
    agency_id: ctx.agencyId, title: opts.title.trim(), lead_id: opts.lead_id ?? null, client_id: opts.client_id ?? null,
    created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create proposal')
  // seed default sections
  await supabase.from('proposal_sections').insert(DEFAULT_SECTIONS.map((s, idx) => ({
    agency_id: ctx.agencyId, proposal_id: data.id, kind: s.kind, title: s.title, sort_order: idx + 1,
  })))
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: opts.client_id ?? null, action: 'proposal.created', entityType: 'proposal', entityId: data.id, description: `Created proposal: ${opts.title.trim()}` })
  return data as Proposal
}

export async function updateSection(id: string, body: string): Promise<void> {
  const { error } = await supabase.from('proposal_sections').update({ body }).eq('id', id)
  if (error) throw new Error(error.message)
}

async function recomputeTotal(proposalId: string): Promise<void> {
  const { data } = await supabase.from('proposal_line_items').select('quantity, unit_price_cents').eq('proposal_id', proposalId)
  const total = (data ?? []).reduce((n, r) => n + (r.quantity as number) * (r.unit_price_cents as number), 0)
  await supabase.from('proposals').update({ total_cents: total }).eq('id', proposalId)
}

export async function addServiceLine(proposalId: string, service: Service, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('proposal_line_items').insert({
    agency_id: ctx.agencyId, proposal_id: proposalId, service_id: service.id, name: service.name,
    description: service.description, quantity: 1, unit_price_cents: service.price_cents,
    billing_kind: service.billing_type === 'one_time' ? 'one_time' : 'recurring',
  })
  if (error) throw new Error(error.message)
  await recomputeTotal(proposalId)
}
export async function addPackageLine(proposalId: string, pkg: Package, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('proposal_line_items').insert({
    agency_id: ctx.agencyId, proposal_id: proposalId, package_id: pkg.id, name: pkg.name,
    description: pkg.description, quantity: 1, unit_price_cents: pkg.price_cents,
    billing_kind: pkg.billing_frequency === 'one_time' ? 'one_time' : 'recurring',
  })
  if (error) throw new Error(error.message)
  await recomputeTotal(proposalId)
}
export async function removeLine(item: ProposalLineItem): Promise<void> {
  const { error } = await supabase.from('proposal_line_items').delete().eq('id', item.id)
  if (error) throw new Error(error.message)
  await recomputeTotal(item.proposal_id)
}

export async function setProposalStatus(p: Proposal, status: ProposalStatus, ctx: Ctx): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_by: ctx.actorId }
  if (status === 'sent') patch.sent_at = new Date().toISOString()
  if (status === 'viewed') patch.viewed_at = new Date().toISOString()
  if (status === 'accepted' || status === 'declined') patch.decided_at = new Date().toISOString()
  const { error } = await supabase.from('proposals').update(patch).eq('id', p.id)
  if (error) throw new Error(error.message)
  await supabase.from('proposal_events').insert({ agency_id: p.agency_id, proposal_id: p.id, type: status, actor_id: ctx.actorId })
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: p.client_id, action: `proposal.${status}`, entityType: 'proposal', entityId: p.id, description: `Proposal "${p.title}" → ${status}` })
}

/** Snapshot current proposal into a version row, then bump version. */
export async function saveVersion(p: Proposal, ctx: Ctx): Promise<void> {
  const full = await getProposal(p.id)
  await supabase.from('proposal_versions').insert({ agency_id: p.agency_id, proposal_id: p.id, version: p.version, snapshot: full as unknown as Record<string, unknown>, created_by: ctx.actorId })
  await supabase.from('proposals').update({ version: p.version + 1, updated_by: ctx.actorId }).eq('id', p.id)
}
