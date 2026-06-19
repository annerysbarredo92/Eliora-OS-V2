import { useState } from 'react'
import { useAgencyContent } from '../hooks'
import { createContent } from '../api'
import { ContentModal } from './ContentModal'
import { ContentDetail } from './ContentDetail'
import { STATUS_META, typeLabel, platformLabel } from '../helpers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { ContentItem, Client } from '@/types'
import type { ContentFormValues, ContentCtx } from '../api'

/** Agency view of a single client's content, used inside the Client Profile. */
export function ClientContentPanel({ client, ctx }: { client: Client; ctx: ContentCtx }) {
  const { items, loading, refresh } = useAgencyContent(client.id)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<ContentItem | null>(null)

  async function handleCreate(v: ContentFormValues) { await createContent(v, ctx); await refresh() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Content created for {client.business_name}.</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>New content</Button>
      </div>

      {loading ? <Skel /> : items.length === 0 ? (
        <Empty>No content yet. Create the first piece and send it for review.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(c => (
            <div key={c.id} onClick={() => setDetail(c)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{c.title}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>{typeLabel(c.content_type)} · {platformLabel(c.platform)}{c.comment_count ? ` · ${c.comment_count} comment${c.comment_count === 1 ? '' : 's'}` : ''}</p>
              </div>
              <Badge variant={STATUS_META[c.status].badge}>{STATUS_META[c.status].label}</Badge>
            </div>
          ))}
        </div>
      )}

      <ContentModal open={showCreate} mode="create" clients={[client]} lockedClientId={client.id} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      {detail && <ContentDetail content={detail} role="agency" ctx={ctx} onChanged={refresh} onClose={() => setDetail(null)} />}
    </div>
  )
}

function Skel() { return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 48, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div> }
function Empty({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: 13.5, color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>{children}</p> }
