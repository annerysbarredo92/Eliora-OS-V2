import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { ClientProductService, ProductType, PricingType, ProductStatus } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export async function listProducts(clientId: string): Promise<ClientProductService[]> {
  const { data, error } = await supabase
    .from('client_products_services')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) { console.error('listProducts:', error.message); throw new Error(error.message) }
  return (data ?? []) as ClientProductService[]
}

export interface ProductFormValues {
  name: string
  type: ProductType
  description: string
  target_audience: string
  benefits: string[]
  pricing_type: PricingType
  price_cents: number | null
  price_min_cents: number | null
  price_max_cents: number | null
  price_label: string
  status: ProductStatus
  seasonal_availability: string
  include_in_ai_context: boolean
}

export async function createProduct(clientId: string, values: ProductFormValues, ctx: Ctx): Promise<ClientProductService> {
  const { data, error } = await supabase
    .from('client_products_services')
    .insert({
      agency_id:            ctx.agencyId,
      client_id:            clientId,
      name:                 values.name.trim(),
      type:                 values.type,
      description:          values.description.trim() || null,
      target_audience:      values.target_audience.trim() || null,
      benefits:             values.benefits,
      pricing_type:         values.pricing_type,
      price_cents:          values.price_cents,
      price_min_cents:      values.price_min_cents,
      price_max_cents:      values.price_max_cents,
      price_label:          values.price_label.trim() || null,
      status:               values.status,
      seasonal_availability: values.seasonal_availability.trim() || null,
      include_in_ai_context: values.include_in_ai_context,
      created_by:           ctx.actorId,
      updated_by:           ctx.actorId,
    })
    .select('*')
    .single()
  if (error) { console.error('createProduct:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'product.created', entityType: 'client_product', entityId: data.id,
    description: `Added product/service: ${values.name.trim()}`,
  })
  return data as ClientProductService
}

export async function updateProduct(id: string, clientId: string, values: ProductFormValues, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('client_products_services')
    .update({
      name:                 values.name.trim(),
      type:                 values.type,
      description:          values.description.trim() || null,
      target_audience:      values.target_audience.trim() || null,
      benefits:             values.benefits,
      pricing_type:         values.pricing_type,
      price_cents:          values.price_cents,
      price_min_cents:      values.price_min_cents,
      price_max_cents:      values.price_max_cents,
      price_label:          values.price_label.trim() || null,
      status:               values.status,
      seasonal_availability: values.seasonal_availability.trim() || null,
      include_in_ai_context: values.include_in_ai_context,
      updated_by:           ctx.actorId,
    })
    .eq('id', id)
  if (error) { console.error('updateProduct:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'product.updated', entityType: 'client_product', entityId: id,
    description: `Updated product/service: ${values.name.trim()}`,
  })
}

export async function setProductImage(id: string, clientId: string, assetId: string | null, ctx: Ctx): Promise<void> {
  const { error } = await supabase
    .from('client_products_services')
    .update({ primary_asset_id: assetId, updated_by: ctx.actorId })
    .eq('id', id)
  if (error) { console.error('setProductImage:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'product.updated', entityType: 'client_product', entityId: id,
    description: assetId ? 'Set product image' : 'Removed product image',
  })
}

export async function deleteProduct(id: string, clientId: string, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('client_products_services').delete().eq('id', id)
  if (error) { console.error('deleteProduct:', error.message); throw new Error(error.message) }
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId,
    action: 'product.deleted', entityType: 'client_product',
    description: 'Deleted a product/service',
  })
}
