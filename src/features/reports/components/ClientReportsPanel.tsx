import { useState } from 'react'
import { useAgencyReports } from '../hooks'
import { uploadReport, setReportVisible, setReportArchived, deleteReport, downloadReport } from '../api'
import { ReportUploadModal } from './ReportUploadModal'
import { formatBytes } from '@/lib/storage'
import { relativeTime } from '@/features/clients/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ActionMenu } from '@/components/ui/Menu'
import type { Client } from '@/types'
import type { ReportsCtx, ReportMeta } from '../api'

/** Agency view of a single client's reports, used inside the Client Profile. */
export function ClientReportsPanel({ client, ctx }: { client: Client; ctx: ReportsCtx }) {
  const { reports, loading, error, refresh } = useAgencyReports(client.id)
  const [showUpload, setShowUpload] = useState(false)

  async function handleUpload(file: File, meta: ReportMeta) { await uploadReport(file, meta, ctx); await refresh() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Reports shared with {client.business_name}.</p>
        <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>Upload report</Button>
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      {loading ? <Skel /> : reports.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>No reports yet. Upload a finished report to share.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, opacity: r.status === 'archived' ? 0.6 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>{r.period_label ? `${r.period_label} · ` : ''}{relativeTime(r.created_at)}{r.file_name ? ` · ${formatBytes(r.size_bytes)}` : ''}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant={r.is_client_visible ? 'success' : 'default'}>{r.is_client_visible ? 'Shared' : 'Private'}</Badge>
                <ActionMenu items={[
                  { label: 'Download', onClick: () => downloadReport(r, ctx) },
                  { label: r.is_client_visible ? 'Unshare' : 'Share', onClick: () => setReportVisible(r, !r.is_client_visible, ctx).then(refresh) },
                  { label: r.status === 'archived' ? 'Restore' : 'Archive', onClick: () => setReportArchived(r, r.status !== 'archived', ctx).then(refresh) },
                  { label: 'Delete', onClick: () => deleteReport(r, ctx).then(refresh), danger: true, dividerBefore: true },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}

      <ReportUploadModal open={showUpload} clients={[client]} lockedClientId={client.id} onClose={() => setShowUpload(false)} onSubmit={handleUpload} />
    </div>
  )
}

function Skel() { return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 48, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div> }
