import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import { storagePath, uploadToStorage, removeFromStorage, openStoredFile } from '@/lib/storage'
import type { AssetFolder, ClientAsset, FileRequest } from '@/types'

export interface FilesCtx {
  agencyId: string
  clientId: string
  actorId: string
  role: 'agency' | 'client'
}

/* ── Folders ─────────────────────────────────────────────── */
export async function ensureFolders(clientId: string): Promise<void> {
  const { error } = await supabase.rpc('ensure_client_folders', { _client_id: clientId })
  if (error) console.error('ensure_client_folders:', error.message)
}

export async function listFolders(clientId: string): Promise<AssetFolder[]> {
  const { data, error } = await supabase.from('asset_folders').select('*').eq('client_id', clientId).order('sort_order')
  if (error) { console.error('listFolders:', error.message); return [] }
  return (data ?? []) as AssetFolder[]
}

export async function createFolder(name: string, ctx: FilesCtx): Promise<void> {
  const { error } = await supabase.from('asset_folders').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId, name: name.trim(), is_default: false, sort_order: 50, created_by: ctx.actorId,
  })
  if (error) { console.error('createFolder:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'folder.created', entityType: 'folder', description: `Created folder: ${name.trim()}` })
}

/* ── Files ───────────────────────────────────────────────── */
export async function listAgencyFiles(clientId: string): Promise<ClientAsset[]> {
  const { data, error } = await supabase.from('client_assets').select('*').eq('client_id', clientId).eq('is_archived', false).order('created_at', { ascending: false })
  if (error) { console.error('listAgencyFiles:', error.message); throw new Error(error.message) }
  return (data ?? []) as ClientAsset[]
}

export async function listClientFiles(): Promise<ClientAsset[]> {
  const { data, error } = await supabase.from('client_assets_client').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listClientFiles:', error.message); return [] }
  return (data ?? []) as ClientAsset[]
}

export async function uploadFile(
  file: File, opts: { folderId: string | null; isClientVisible: boolean }, ctx: FilesCtx,
): Promise<void> {
  const path = storagePath(ctx.agencyId, ctx.clientId, 'files', file.name)
  await uploadToStorage(path, file)
  const { error } = await supabase.from('client_assets').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId, folder_id: opts.folderId,
    name: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size,
    owner_role: ctx.role, is_client_visible: ctx.role === 'client' ? true : opts.isClientVisible,
    created_by: ctx.actorId, updated_by: ctx.actorId,
  })
  if (error) { console.error('uploadFile insert:', error.message); await removeFromStorage(path); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: ctx.role === 'client' ? 'file.uploaded_by_client' : 'file.uploaded', entityType: 'file', description: `Uploaded file: ${file.name}` })
}

export async function setFileVisible(f: ClientAsset, visible: boolean, ctx: FilesCtx): Promise<void> {
  const { error } = await supabase.from('client_assets').update({ is_client_visible: visible, updated_by: ctx.actorId }).eq('id', f.id)
  if (error) { console.error('setFileVisible:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: visible ? 'file.shared' : 'file.unshared', entityType: 'file', entityId: f.id, description: `${visible ? 'Shared' : 'Unshared'} file: ${f.name}` })
}

export async function moveFile(f: ClientAsset, folderId: string | null, ctx: FilesCtx): Promise<void> {
  const { error } = await supabase.from('client_assets').update({ folder_id: folderId, updated_by: ctx.actorId }).eq('id', f.id)
  if (error) { console.error('moveFile:', error.message); throw new Error(error.message) }
}

export async function renameFile(f: ClientAsset, name: string, ctx: FilesCtx): Promise<void> {
  const { error } = await supabase.from('client_assets').update({ name: name.trim(), updated_by: ctx.actorId }).eq('id', f.id)
  if (error) { console.error('renameFile:', error.message); throw new Error(error.message) }
}

export async function deleteFile(f: ClientAsset, ctx: FilesCtx): Promise<void> {
  const { error } = await supabase.from('client_assets').delete().eq('id', f.id)
  if (error) { console.error('deleteFile:', error.message); throw new Error(error.message) }
  await removeFromStorage(f.storage_path)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'file.deleted', entityType: 'file', entityId: f.id, description: `Deleted file: ${f.name}` })
}

export async function downloadFile(f: ClientAsset, ctx?: FilesCtx): Promise<void> {
  await openStoredFile(f.storage_path)
  if (ctx) await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'file.downloaded', entityType: 'file', entityId: f.id, description: `Downloaded file: ${f.name}` })
}

/* ── File requests ───────────────────────────────────────── */
export async function listFileRequests(clientId: string): Promise<FileRequest[]> {
  const { data, error } = await supabase.from('file_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) { console.error('listFileRequests:', error.message); return [] }
  return (data ?? []) as FileRequest[]
}

export async function createFileRequest(title: string, description: string, ctx: FilesCtx): Promise<void> {
  const { error } = await supabase.from('file_requests').insert({
    agency_id: ctx.agencyId, client_id: ctx.clientId, title: title.trim(), description: description.trim() || null, created_by: ctx.actorId,
  })
  if (error) { console.error('createFileRequest:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: ctx.clientId, action: 'file_request.created', entityType: 'file_request', description: `Requested files: ${title.trim()}` })
}
