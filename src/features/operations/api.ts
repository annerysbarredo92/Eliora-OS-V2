import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type {
  AgencySetupStep, AgencyOnboardingProgress, SetupStepStatus,
  Service, BillingType, Package, BillingFrequency,
} from '@/types'

interface Ctx { agencyId: string; actorId: string }

/* ── Onboarding / setup ──────────────────────────────────── */

/** Seed the 8 steps + progress row, then auto-complete data-derived steps. */
export async function ensureSetup(agencyId: string): Promise<void> {
  const seed = await supabase.rpc('seed_agency_setup', { _agency_id: agencyId })
  if (seed.error) console.error('seed_agency_setup failed:', seed.error.message)
  const rec = await supabase.rpc('reconcile_agency_setup', { _agency_id: agencyId })
  if (rec.error) console.error('reconcile_agency_setup failed:', rec.error.message)
}

export async function getSteps(): Promise<AgencySetupStep[]> {
  const { data, error } = await supabase
    .from('agency_setup_steps').select('*').order('sort_order', { ascending: true })
  if (error) { console.error('getSteps failed:', error.message); return [] }
  return (data ?? []) as AgencySetupStep[]
}

export async function getProgress(): Promise<AgencyOnboardingProgress | null> {
  const { data, error } = await supabase
    .from('agency_onboarding_progress').select('*').maybeSingle()
  if (error) { console.error('getProgress failed:', error.message); return null }
  return (data as AgencyOnboardingProgress) ?? null
}

export async function setStepStatus(step: AgencySetupStep, status: SetupStepStatus, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('agency_setup_steps')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', step.id)
  if (error) { console.error('setStepStatus failed:', error.message); throw new Error(error.message) }

  if (status === 'completed') {
    await logActivity({
      agencyId: ctx.agencyId, actorId: ctx.actorId,
      action: 'onboarding.step_completed', entityType: 'onboarding_step', entityId: step.id,
      description: `Completed onboarding step: ${step.title}`,
    })
  }
}

export async function skipOnboarding(ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('agency_onboarding_progress')
    .update({ skipped: true })
    .eq('agency_id', ctx.agencyId)
  if (error) { console.error('skipOnboarding failed:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'onboarding.skipped', entityType: 'onboarding', description: 'Skipped agency onboarding',
  })
}

/* ── Services ────────────────────────────────────────────── */

export interface ServiceFormValues {
  name: string
  category: string
  description: string
  price_cents: number
  billing_type: BillingType
  is_active: boolean
}

export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listServices failed:', error.message); throw new Error(error.message) }
  return (data ?? []) as Service[]
}

export async function createService(values: ServiceFormValues, ctx: Ctx): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert({
      agency_id: ctx.agencyId, name: values.name.trim(),
      category: values.category || null, description: values.description.trim() || null,
      price_cents: values.price_cents, billing_type: values.billing_type, is_active: values.is_active,
      created_by: ctx.actorId, updated_by: ctx.actorId,
    })
    .select('*').single()
  if (error || !data) { console.error('createService failed:', error?.message); throw new Error(error?.message ?? 'Could not create service') }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'service.created', entityType: 'service', entityId: data.id,
    description: `Created service: ${values.name.trim()}`,
  })
  // First active service completes the "services" onboarding step.
  await supabase.rpc('reconcile_agency_setup', { _agency_id: ctx.agencyId })
  return data as Service
}

export async function updateService(id: string, values: ServiceFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('services')
    .update({
      name: values.name.trim(), category: values.category || null,
      description: values.description.trim() || null, price_cents: values.price_cents,
      billing_type: values.billing_type, is_active: values.is_active, updated_by: ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateService failed:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'service.updated', entityType: 'service', entityId: id,
    description: `Updated service: ${values.name.trim()}`,
  })
}

export async function setServiceActive(service: Service, active: boolean, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('services').update({ is_active: active, updated_by: ctx.actorId }).eq('id', service.id)
  if (error) { console.error('setServiceActive failed:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: active ? 'service.activated' : 'service.deactivated', entityType: 'service', entityId: service.id,
    description: `${active ? 'Activated' : 'Deactivated'} service: ${service.name}`,
  })
}

/* ── Packages ────────────────────────────────────────────── */

export interface PackageFormValues {
  name: string
  description: string
  price_cents: number
  billing_frequency: BillingFrequency
  is_active: boolean
  service_ids: string[]
}

export async function listPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from('packages').select('*, package_services(*)').order('created_at', { ascending: false })
  if (error) { console.error('listPackages failed:', error.message); throw new Error(error.message) }
  return (data ?? []) as Package[]
}

async function syncPackageServices(pkgId: string, agencyId: string, serviceIds: string[]) {
  // Replace the join set with the provided service ids.
  const { data: existing } = await supabase.from('package_services').select('id, service_id').eq('package_id', pkgId)
  const have = new Set((existing ?? []).map(r => r.service_id))
  const want = new Set(serviceIds)

  const toAdd = serviceIds.filter(id => !have.has(id))
  const toRemove = (existing ?? []).filter(r => !want.has(r.service_id)).map(r => r.id)

  if (toAdd.length) {
    const { error } = await supabase.from('package_services')
      .insert(toAdd.map(service_id => ({ agency_id: agencyId, package_id: pkgId, service_id })))
    if (error) console.error('attach services failed:', error.message)
  }
  if (toRemove.length) {
    const { error } = await supabase.from('package_services').delete().in('id', toRemove)
    if (error) console.error('detach services failed:', error.message)
  }
}

export async function createPackage(values: PackageFormValues, ctx: Ctx): Promise<Package> {
  const { data, error } = await supabase
    .from('packages')
    .insert({
      agency_id: ctx.agencyId, name: values.name.trim(),
      description: values.description.trim() || null, price_cents: values.price_cents,
      billing_frequency: values.billing_frequency, is_active: values.is_active,
      created_by: ctx.actorId, updated_by: ctx.actorId,
    })
    .select('*').single()
  if (error || !data) { console.error('createPackage failed:', error?.message); throw new Error(error?.message ?? 'Could not create package') }

  await syncPackageServices(data.id, ctx.agencyId, values.service_ids)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'package.created', entityType: 'package', entityId: data.id,
    description: `Created package: ${values.name.trim()}`,
  })
  await supabase.rpc('reconcile_agency_setup', { _agency_id: ctx.agencyId })
  return data as Package
}

export async function updatePackage(id: string, values: PackageFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('packages')
    .update({
      name: values.name.trim(), description: values.description.trim() || null,
      price_cents: values.price_cents, billing_frequency: values.billing_frequency,
      is_active: values.is_active, updated_by: ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updatePackage failed:', error.message); throw new Error(error.message) }

  await syncPackageServices(id, ctx.agencyId, values.service_ids)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'package.updated', entityType: 'package', entityId: id,
    description: `Updated package: ${values.name.trim()}`,
  })
}

export async function setPackageActive(pkg: Package, active: boolean, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('packages').update({ is_active: active, updated_by: ctx.actorId }).eq('id', pkg.id)
  if (error) { console.error('setPackageActive failed:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: active ? 'package.activated' : 'package.deactivated', entityType: 'package', entityId: pkg.id,
    description: `${active ? 'Activated' : 'Deactivated'} package: ${pkg.name}`,
  })
}

export async function setDefaultPackage(pkg: Package, ctx: Ctx): Promise<void> {
  // Only one default per agency — clear the rest first (partial unique index enforces it).
  const clear = await supabase
    .from('packages').update({ is_default: false }).eq('agency_id', ctx.agencyId).eq('is_default', true)
  if (clear.error) { console.error('clear default failed:', clear.error.message); throw new Error(clear.error.message) }

  const { error } = await supabase.from('packages').update({ is_default: true, updated_by: ctx.actorId }).eq('id', pkg.id)
  if (error) { console.error('setDefaultPackage failed:', error.message); throw new Error(error.message) }

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'package.default_changed', entityType: 'package', entityId: pkg.id,
    description: `Set default package: ${pkg.name}`,
  })
}

export async function logWorkspacePreview(ctx: Ctx): Promise<void> {
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId,
    action: 'workspace.preview_opened', entityType: 'workspace', description: 'Opened workspace preview',
  })
}
