import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import { storagePath, uploadToStorage, removeFromStorage, openStoredFile } from '@/lib/storage'
import type { Report } from '@/types'

export interface ReportsCtx {
  agencyId: string
  actorId: string
}

export interface ReportMeta {
  client_id: string
  title: string
  period_label: string
  description: string
  is_client_visible: boolean
}

export async function listAgencyReports(clientId?: string): Promise<Report[]> {
  let q = supabase.from('reports').select('*').order('created_at', { ascending: false })
  if (clientId) q = q.eq('client_id', clientId)
  const { data, error } = await q
  if (error) { console.error('listAgencyReports:', error.message); throw new Error(error.message) }
  return (data ?? []) as Report[]
}

export async function listClientReports(): Promise<Report[]> {
  const { data, error } = await supabase.from('reports_client').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listClientReports:', error.message); return [] }
  return (data ?? []) as Report[]
}

export async function uploadReport(file: File, meta: ReportMeta, ctx: ReportsCtx): Promise<void> {
  const path = storagePath(ctx.agencyId, meta.client_id, 'reports', file.name)
  await uploadToStorage(path, file)
  const { error } = await supabase.from('reports').insert({
    agency_id: ctx.agencyId, client_id: meta.client_id, title: meta.title.trim(),
    period_label: meta.period_label.trim() || null, description: meta.description.trim() || null,
    storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size,
    is_client_visible: meta.is_client_visible, status: 'active', created_by: ctx.actorId, updated_by: ctx.actorId,
  })
  if (error) { console.error('uploadReport insert:', error.message); await removeFromStorage(path); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: meta.client_id, action: 'report.uploaded', entityType: 'report', description: `Uploaded report: ${meta.title.trim()}` })
}

export async function replaceReportFile(report: Report, file: File, ctx: ReportsCtx): Promise<void> {
  const path = storagePath(ctx.agencyId, report.client_id, 'reports', file.name)
  await uploadToStorage(path, file)
  const { error } = await supabase.from('reports').update({
    storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, updated_by: ctx.actorId,
  }).eq('id', report.id)
  if (error) { console.error('replaceReportFile:', error.message); await removeFromStorage(path); throw new Error(error.message) }
  if (report.storage_path) await removeFromStorage(report.storage_path)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: report.client_id, action: 'report.replaced', entityType: 'report', entityId: report.id, description: `Replaced report file: ${report.title}` })
}

export async function setReportArchived(report: Report, archived: boolean, ctx: ReportsCtx): Promise<void> {
  const { error } = await supabase.from('reports').update({ status: archived ? 'archived' : 'active', updated_by: ctx.actorId }).eq('id', report.id)
  if (error) { console.error('setReportArchived:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: report.client_id, action: archived ? 'report.archived' : 'report.unarchived', entityType: 'report', entityId: report.id, description: `${archived ? 'Archived' : 'Restored'} report: ${report.title}` })
}

export async function setReportVisible(report: Report, visible: boolean, ctx: ReportsCtx): Promise<void> {
  const { error } = await supabase.from('reports').update({ is_client_visible: visible, updated_by: ctx.actorId }).eq('id', report.id)
  if (error) { console.error('setReportVisible:', error.message); throw new Error(error.message) }
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: report.client_id, action: visible ? 'report.shared' : 'report.unshared', entityType: 'report', entityId: report.id, description: `${visible ? 'Shared' : 'Unshared'} report: ${report.title}` })
}

export async function deleteReport(report: Report, ctx: ReportsCtx): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', report.id)
  if (error) { console.error('deleteReport:', error.message); throw new Error(error.message) }
  if (report.storage_path) await removeFromStorage(report.storage_path)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: report.client_id, action: 'report.deleted', entityType: 'report', entityId: report.id, description: `Deleted report: ${report.title}` })
}

export async function downloadReport(report: Report, ctx?: ReportsCtx): Promise<void> {
  await openStoredFile(report.storage_path)
  if (ctx) await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: report.client_id, action: 'report.downloaded', entityType: 'report', entityId: report.id, description: `Downloaded report: ${report.title}` })
}
