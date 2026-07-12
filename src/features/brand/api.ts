import { supabase } from '@/lib/supabase'
import { storagePath, uploadToStorage, removeFromStorage, signedUrl, openStoredFile } from '@/lib/storage'
import { logActivity } from '@/features/activity/api'
import { updateDiscoveryData } from '@/features/clients/api'
import type { ClientAsset } from '@/types'

export interface BrandCtx { agencyId: string; clientId: string; actorId: string }

export type LogoSlot = 'primary' | 'secondary' | 'icon'

const IMAGE_ACCEPT = 'image/*'
const ALLOWED_BRAND_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp',
  'application/pdf', 'application/zip',
]

export function validateBrandFile(file: File): string | null {
  if (ALLOWED_BRAND_TYPES.length > 0 && !ALLOWED_BRAND_TYPES.some(t => file.type.startsWith(t.split('/')[0]) || file.type === t)) {
    return `File type "${file.type}" is not supported. Use images, PDF, or ZIP.`
  }
  if (file.size > 50 * 1024 * 1024) return 'File must be under 50 MB'
  return null
}

/* ── Folder helpers ──────────────────────────────────────────── */

export async function findOrCreateBrandFolder(
  name: string,
  sortOrder: number,
  ctx: BrandCtx,
): Promise<string> {
  const { data: existing } = await supabase
    .from('asset_folders')
    .select('id')
    .eq('client_id', ctx.clientId)
    .eq('name', name)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from('asset_folders')
    .insert({ agency_id: ctx.agencyId, client_id: ctx.clientId, name, is_default: true, sort_order: sortOrder, created_by: ctx.actorId })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

/* ── Brand asset list ────────────────────────────────────────── */

export async function listBrandAssets(clientId: string): Promise<{ folders: { id: string; name: string }[]; files: ClientAsset[] }> {
  const [{ data: folders }, { data: files, error: fe }] = await Promise.all([
    supabase.from('asset_folders').select('id, name').eq('client_id', clientId).order('sort_order'),
    supabase.from('client_assets').select('*').eq('client_id', clientId).eq('is_archived', false).order('created_at', { ascending: false }),
  ])
  if (fe) { console.error('listBrandAssets files:', fe.message); throw new Error(fe.message) }
  return { folders: (folders ?? []) as { id: string; name: string }[], files: (files ?? []) as ClientAsset[] }
}

/* ── Logo upload ─────────────────────────────────────────────── */

export async function uploadLogo(
  file: File,
  slot: LogoSlot,
  currentLogoIds: { primary: string | null; secondary: string | null; icon: string | null },
  ctx: BrandCtx,
  onProgress?: (pct: number) => void,
): Promise<ClientAsset> {
  const validationError = validateBrandFile(file)
  if (validationError) throw new Error(validationError)

  onProgress?.(10)
  const logoFolderId = await findOrCreateBrandFolder('Logos', 4, ctx)
  onProgress?.(20)

  const path = storagePath(ctx.agencyId, ctx.clientId, 'brand/logos', file.name)
  await uploadToStorage(path, file)
  onProgress?.(70)

  const { data: asset, error: insertErr } = await supabase.from('client_assets').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId,
    folder_id: logoFolderId, name: `${slot.charAt(0).toUpperCase() + slot.slice(1)} Logo — ${file.name}`,
    storage_path: path, mime_type: file.type || null, size_bytes: file.size,
    owner_role: 'agency', is_client_visible: false, created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()

  if (insertErr) {
    await removeFromStorage(path)
    throw new Error(insertErr.message)
  }
  onProgress?.(85)

  // Update logo_ids in brand_visual
  const newLogoIds = { ...currentLogoIds, [slot]: (asset as ClientAsset).id }
  const currentVisual = await fetchBrandVisual(ctx.clientId)
  await updateDiscoveryData(ctx.clientId, {
    brand_visual: { ...currentVisual, logo_ids: newLogoIds },
  }, ctx)
  onProgress?.(100)

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: 'brand.logo_uploaded', entityType: 'client_asset', entityId: (asset as ClientAsset).id,
    description: `Uploaded ${slot} logo: ${file.name}`,
  })

  return asset as ClientAsset
}

/* ── Logo remove ─────────────────────────────────────────────── */

export async function removeLogo(
  assetId: string,
  storagePt: string,
  slot: LogoSlot,
  currentLogoIds: { primary: string | null; secondary: string | null; icon: string | null },
  ctx: BrandCtx,
): Promise<void> {
  // 1. Clear logo_ids[slot] first
  const currentVisual = await fetchBrandVisual(ctx.clientId)
  const newLogoIds = { ...currentLogoIds, [slot]: null }
  await updateDiscoveryData(ctx.clientId, {
    brand_visual: { ...currentVisual, logo_ids: newLogoIds },
  }, ctx)

  // 2. Delete DB record
  const { error: dbErr } = await supabase.from('client_assets').delete().eq('id', assetId)
  if (dbErr) console.error('removeLogo db delete:', dbErr.message)

  // 3. Delete storage (best-effort, log on failure)
  await removeFromStorage(storagePt)

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: 'brand.logo_removed', entityType: 'client_asset',
    description: `Removed ${slot} logo`,
  })
}

/* ── Brand file upload (non-logo assets) ─────────────────────── */

export async function uploadBrandFile(
  file: File,
  ctx: BrandCtx,
  onProgress?: (pct: number) => void,
): Promise<ClientAsset> {
  const validationError = validateBrandFile(file)
  if (validationError) throw new Error(validationError)

  onProgress?.(10)
  const folderId = await findOrCreateBrandFolder('Brand Assets', 1, ctx)
  onProgress?.(20)

  const path = storagePath(ctx.agencyId, ctx.clientId, 'brand/assets', file.name)
  await uploadToStorage(path, file)
  onProgress?.(70)

  const { data: asset, error: insertErr } = await supabase.from('client_assets').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId,
    folder_id: folderId, name: file.name,
    storage_path: path, mime_type: file.type || null, size_bytes: file.size,
    owner_role: 'agency', is_client_visible: false, created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()

  if (insertErr) {
    await removeFromStorage(path)
    throw new Error(insertErr.message)
  }
  onProgress?.(100)

  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: 'brand.asset_uploaded', entityType: 'client_asset', entityId: (asset as ClientAsset).id,
    description: `Uploaded brand asset: ${file.name}`,
  })

  return asset as ClientAsset
}

export async function deleteBrandFile(asset: ClientAsset, ctx: BrandCtx): Promise<void> {
  const { error } = await supabase.from('client_assets').delete().eq('id', asset.id)
  if (error) throw new Error(error.message)
  await removeFromStorage(asset.storage_path)
  await logActivity({
    agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId,
    action: 'brand.asset_deleted', entityType: 'client_asset', entityId: asset.id,
    description: `Deleted brand asset: ${asset.name}`,
  })
}

export async function openBrandFile(asset: ClientAsset): Promise<void> {
  await openStoredFile(asset.storage_path)
}

/* ── Signed URL for image preview ────────────────────────────── */

export async function getBrandSignedUrl(storagePt: string): Promise<string | null> {
  return signedUrl(storagePt)
}

export async function getAssetById(assetId: string): Promise<ClientAsset | null> {
  const { data, error } = await supabase.from('client_assets').select('*').eq('id', assetId).maybeSingle()
  if (error) { console.error('getAssetById:', error.message); return null }
  return data as ClientAsset | null
}

/* ── Helpers ─────────────────────────────────────────────────── */

async function fetchBrandVisual(clientId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from('clients').select('discovery_data').eq('id', clientId).single()
  const dd = (data?.discovery_data ?? {}) as Record<string, unknown>
  const raw = (dd.brand_visual ?? {}) as Record<string, unknown>
  return {
    colors: Array.isArray(raw.colors) ? raw.colors : [],
    fonts: Array.isArray(raw.fonts) ? raw.fonts : [],
    photo_style: typeof raw.photo_style === 'string' ? raw.photo_style : '',
    logo_ids: (raw.logo_ids as { primary: string | null; secondary: string | null; icon: string | null }) ?? { primary: null, secondary: null, icon: null },
  }
}

export { IMAGE_ACCEPT }
