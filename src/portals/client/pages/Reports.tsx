import { useAuth } from '@/hooks/useAuth'
import { useClientReports } from '@/features/reports/hooks'
import { downloadReport } from '@/features/reports/api'
import { formatBytes } from '@/lib/storage'
import { relativeTime } from '@/features/clients/helpers'
import { Button } from '@/components/ui/Button'

export function ClientReports() {
  const { profile: user } = useAuth()
  const { reports, loading } = useClientReports()
  const ctx = user?.agency_id && user?.id ? { agencyId: user.agency_id, actorId: user.id } : undefined

  if (loading) return <div className="animate-fade-up"><div style={{ height: 300, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Performance reports shared by your team.</p>
      </div>

      {reports.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>No reports yet</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>When your team publishes a report, it will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6M9 11h2" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{r.title}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.period_label ? `${r.period_label} · ` : ''}Shared {relativeTime(r.created_at)}{r.file_name ? ` · ${formatBytes(r.size_bytes)}` : ''}</p>
                  {r.description && <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>{r.description}</p>}
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={() => downloadReport(r, ctx)}>Download</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
