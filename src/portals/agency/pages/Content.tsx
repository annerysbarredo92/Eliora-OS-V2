import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import { useAgencyContent } from '@/features/content/hooks'
import { createContent, updateContent, deleteContent } from '@/features/content/api'
import { ContentModal, contentToForm } from '@/features/content/components/ContentModal'
import { ContentDetail } from '@/features/content/components/ContentDetail'
import { STATUS_META, typeLabel, platformLabel } from '@/features/content/helpers'
import { KpiCard } from '@/components/ui/KpiCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/Menu'
import type { ContentItem, ContentStatus } from '@/types'
import type { ContentFormValues } from '@/features/content/api'

export function AgencyContent() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const { items, loading, error, refresh } = useAgencyContent()
  const [filter, setFilter] = useState<ContentStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ContentItem | null>(null)
  const [detail, setDetail] = useState<ContentItem | null>(null)

  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id, role: 'agency' as const } : null
  const clientName = (id: string) => clients.find(c => c.id === id)?.business_name ?? '—'

  const counts = useMemo(() => ({
    total: items.length,
    review: items.filter(i => i.status === 'client_review').length,
    approved: items.filter(i => i.status === 'approved').length,
    revision: items.filter(i => i.status === 'revision_requested').length,
  }), [items])

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  async function handleCreate(v: ContentFormValues) { if (ctx) { await createContent(v, ctx); await refresh() } }
  async function handleEdit(v: ContentFormValues) { if (ctx && editTarget) { await updateContent(editTarget.id, v, ctx); await refresh() } }
  async function handleDelete(c: ContentItem) { if (ctx) { await deleteContent(c, ctx); await refresh() } }

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Content Studio</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Plan content, send it for client review, and track approvals.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} disabled={clients.length === 0}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Create content
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KpiCard label="Total" value={counts.total} accent="violet" />
        <KpiCard label="In Client Review" value={counts.review} accent="gold" />
        <KpiCard label="Approved" value={counts.approved} accent="success" />
        <KpiCard label="Needs Revision" value={counts.revision} accent="muted" />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['all', 'draft', 'client_review', 'approved', 'revision_requested', 'scheduled', 'published'] as (ContentStatus | 'all')[]).map(f => {
          const active = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', border: '1px solid', borderColor: active ? 'var(--violet)' : 'var(--hairline)', background: active ? 'var(--violet)' : 'var(--surface-solid)', color: active ? '#fff' : 'var(--ink-2)' }}>
              {f === 'all' ? 'All' : STATUS_META[f as ContentStatus].label}
            </button>
          )
        })}
      </div>

      {error && <div style={{ fontSize: 13.5, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '14px 16px', borderRadius: 14, marginBottom: 16 }}>{error} — make sure Wave 1 SQL has been run.</div>}

      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <Empty hasAny={items.length > 0} canCreate={clients.length > 0} onCreate={() => setShowCreate(true)} />
      ) : (
        <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {['Title', 'Client', 'Type', 'Platform', 'Status', 'Comments', ''].map(h => <th key={h} style={{ padding: '11px 14px', fontWeight: 700, borderBottom: '1px solid var(--hairline-2)', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setDetail(c)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender-soft)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={cell}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.title}</span></td>
                  <td style={{ ...cell, color: 'var(--ink-2)' }}>{clientName(c.client_id)}</td>
                  <td style={{ ...cell, color: 'var(--ink-2)' }}>{typeLabel(c.content_type)}</td>
                  <td style={{ ...cell, color: 'var(--ink-2)' }}>{platformLabel(c.platform)}</td>
                  <td style={cell}><Badge variant={STATUS_META[c.status].badge}>{STATUS_META[c.status].label}</Badge></td>
                  <td style={{ ...cell, color: 'var(--muted)' }}>{c.comment_count || 0}</td>
                  <td style={cell} onClick={e => e.stopPropagation()}>
                    <ActionMenu items={[
                      { label: 'Open', onClick: () => setDetail(c) },
                      { label: 'Edit', onClick: () => setEditTarget(c) },
                      { label: 'Delete', onClick: () => handleDelete(c), danger: true, dividerBefore: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContentModal open={showCreate} mode="create" clients={clients} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      <ContentModal open={!!editTarget} mode="edit" clients={clients} initial={editTarget ? contentToForm(editTarget) : undefined} onClose={() => setEditTarget(null)} onSubmit={handleEdit} />
      {detail && ctx && <ContentDetail content={detail} role="agency" ctx={ctx} onChanged={refresh} onClose={() => setDetail(null)} />}
    </div>
  )
}

const cell: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid var(--hairline-2)', verticalAlign: 'middle' }

function Skeleton() {
  return <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ height: 38, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div>
}

function Empty({ hasAny, canCreate, onCreate }: { hasAny: boolean; canCreate: boolean; onCreate: () => void }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>{hasAny ? 'No content matches this filter' : 'No content yet'}</p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.6 }}>
        {!canCreate ? 'Add a client first, then create content for them.' : hasAny ? 'Try a different status filter.' : 'Create your first piece of content and send it for client review.'}
      </p>
      {canCreate && !hasAny && <Button variant="primary" size="sm" onClick={onCreate}>Create content</Button>}
    </div>
  )
}
