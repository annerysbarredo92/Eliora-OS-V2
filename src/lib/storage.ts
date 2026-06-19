import { supabase } from './supabase'

export const BUCKET = 'eliora-files'

/** Build a storage path. Objects are isolated by agency in their first segment. */
export function storagePath(agencyId: string, clientId: string, area: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uid = crypto.randomUUID().slice(0, 8)
  return `${agencyId}/clients/${clientId}/${area}/${uid}-${safe}`
}

export async function uploadToStorage(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  })
  if (error) { console.error('uploadToStorage failed:', error.message); throw new Error(error.message) }
}

/** Signed URL for private download/preview (valid for ~5 minutes). */
export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error) { console.error('signedUrl failed:', error.message); return null }
  return data?.signedUrl ?? null
}

/** Open a stored file in a new tab via a fresh signed URL. */
export async function openStoredFile(path: string | null): Promise<void> {
  if (!path) return
  const url = await signedUrl(path)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export async function removeFromStorage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.error('removeFromStorage failed:', error.message)
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
