import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { ContractTemplate, Contract, ContractSignature, ContractStatus } from '@/types'

interface Ctx { agencyId: string; actorId: string }

/* templates */
export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase.from('contract_templates').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listContractTemplates:', error.message); return [] }
  return (data ?? []) as ContractTemplate[]
}
export async function saveContractTemplate(id: string | null, name: string, body: string, ctx: Ctx): Promise<void> {
  if (id) {
    const { error } = await supabase.from('contract_templates').update({ name: name.trim(), body, updated_by: ctx.actorId }).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('contract_templates').insert({ agency_id: ctx.agencyId, name: name.trim(), body, created_by: ctx.actorId, updated_by: ctx.actorId })
    if (error) throw new Error(error.message)
    await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, action: 'contract_template.created', entityType: 'contract_template', description: `Created contract template: ${name.trim()}` })
  }
}

/* contracts */
export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await supabase.from('contracts').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listContracts:', error.message); throw new Error(error.message) }
  return (data ?? []) as Contract[]
}

export async function listContractsByClient(clientId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) { console.error('listContractsByClient:', error.message); return [] }
  return (data ?? []) as Contract[]
}
export async function createContract(opts: { title: string; body: string; proposal_id?: string | null; client_id?: string | null; lead_id?: string | null; template_id?: string | null }, ctx: Ctx): Promise<Contract> {
  const { data, error } = await supabase.from('contracts').insert({
    agency_id: ctx.agencyId, title: opts.title.trim(), body: opts.body, proposal_id: opts.proposal_id ?? null,
    client_id: opts.client_id ?? null, lead_id: opts.lead_id ?? null, template_id: opts.template_id ?? null,
    created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create contract')
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: opts.client_id ?? null, action: 'contract.created', entityType: 'contract', entityId: data.id, description: `Created contract: ${opts.title.trim()}` })
  return data as Contract
}
export async function setContractStatus(c: Contract, status: ContractStatus, ctx: Ctx): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_by: ctx.actorId }
  if (status === 'sent') patch.sent_at = new Date().toISOString()
  const { error } = await supabase.from('contracts').update(patch).eq('id', c.id)
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: c.client_id, action: 'contract.status_changed', entityType: 'contract', entityId: c.id, description: `Contract "${c.title}" → ${status}` })
}

/** Simple in-app signature: typed name stored + contract marked signed. */
export async function signContract(c: Contract, signerName: string, signerEmail: string, isClient: boolean, ctx: Ctx): Promise<void> {
  const { error: sigErr } = await supabase.from('contract_signatures').insert({
    agency_id: c.agency_id, contract_id: c.id, signer_name: signerName.trim(), signer_email: signerEmail.trim() || null,
    signature_text: signerName.trim(), is_client: isClient, user_agent: navigator.userAgent.slice(0, 200),
  })
  if (sigErr) throw new Error(sigErr.message)
  const { error } = await supabase.from('contracts').update({ status: 'signed', signed_at: new Date().toISOString(), updated_by: ctx.actorId }).eq('id', c.id)
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: c.client_id, action: 'contract.signed', entityType: 'contract', entityId: c.id, description: `Contract "${c.title}" signed by ${signerName.trim()}` })
}
export async function listSignatures(contractId: string): Promise<ContractSignature[]> {
  const { data } = await supabase.from('contract_signatures').select('*').eq('contract_id', contractId).order('signed_at')
  return (data ?? []) as ContractSignature[]
}
