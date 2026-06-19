import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import { useAgencyReports } from '@/features/reports/hooks'
import { uploadReport, setReportVisible, setReportArchived, deleteReport, downloadReport } from '@/features/reports/api'
import { ReportUploadModal } from '@/features/reports/components/ReportUploadModal'
import { formatBytes } from '@/lib/storage'
import { relativeTime } from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ActionMenu } from '@/components/ui/Menu'
import type { ReportMeta } from '@/features/reports/api'

export function AgencyReports() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const { reports, loading, error, refresh } = useAgencyReports()
  const [showUpload, setShowUpload] = useState(false)

  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null
  const clientName = (id: string) => clients.find(c => c.id === id)?.business_name ?? '—'

  async function handleUpload(file: File, meta: ReportMeta) { if (ctx) { await uploadReport(file, meta, ctx); await refresh() } }

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Reports</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Upload finished reports and share them with clients.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowUpload(true)} disabled={clients.length === 0}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
          Upload report
        </Button>
      </div>

      {error && <div style={{ fontSize: 13.5, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '14px 16px', borderRadius: 14, marginBottom: 16 }}>{error} — make sure Wave 1 SQL has been run and Storage is enabled.</div>}

      {loading ? (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 38, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div>
      ) : reports.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>No reports yet</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 360, margin: '0 auto 20px' }}>{clients.length === 0 ? 'Add a client first, then upload a report.' : 'Upload a finished report (PDF, XLSX, etc.) to share with a client.'}</p>
          {clients.length > 0 && <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>Upload report</Button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 18, opacity: r.status === 'archived' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{r.title}</p>
                  {r.status === 'archived' && <Badge variant="default">Archived</Badge>}
                  <Badge variant={r.is_client_visible ? 'success' : 'default'}>{r.is_client_visible ? 'Shared' : 'Private'}</Badge>
                </div>
                <ActionMenu items={[
                  { label: 'Download', onClick: () => ctx && downloadReport(r, ctx) },
                  { label: r.is_client_visible ? 'Unshare' : 'Share', onClick: () => ctx && setReportVisible(r, !r.is_client_visible, ctx).then(refresh) },
                  { label: r.status === 'archived' ? 'Restore' : 'Archive', onClick: () => ctx && setReportArchived(r, r.status !== 'archived', ctx).then(refresh) },
                  { label: 'Delete', onClick: () => ctx && deleteReport(r, ctx).then(refresh), danger: true, dividerBefore: true },
                ]} />
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{clientName(r.client_id)}{r.period_label ? ` · ${r.period_label}` : ''}</p>
              {r.description && <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5 }}>{r.description}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline-2)' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.file_name ? `${formatBytes(r.size_bytes)} · ${relativeTime(r.created_at)}` : 'No file'}</span>
                <button onClick={() => ctx && downloadReport(r, ctx)} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer' }}>Download ↓</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReportUploadModal open={showUpload} clients={clients} onClose={() => setShowUpload(false)} onSubmit={handleUpload} />
    </div>
  )
}
