import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClientContent } from '@/features/content/hooks'
import { ContentDetail } from '@/features/content/components/ContentDetail'
import { STATUS_META, typeLabel, platformLabel } from '@/features/content/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { ContentItem } from '@/types'

export function ClientContent() {
  const { profile: user } = useAuth()
  const { items, loading, refresh } = useClientContent()
  const [detail, setDetail] = useState<ContentItem | null>(null)

  const ctx = user?.agency_id && user?.id ? { agencyId: user.agency_id, actorId: user.id, role: 'client' as const } : null
  const pending = items.filter(i => i.status === 'client_review')
  const others = items.filter(i => i.status !== 'client_review')

  if (loading) {
    return <div className="animate-fade-up"><div style={{ height: 300, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Content</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Review content from your team and approve it before it goes live.</p>
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>Nothing to review yet</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>When your team sends content for review, it will appear here.</p>
        </div>
      ) : (
        <>
          <Section title={`Pending your review${pending.length ? ` (${pending.length})` : ''}`}>
            {pending.length === 0 ? <p style={{ fontSize: 13, color: 'var(--muted)', padding: '6px 2px' }}>You're all caught up.</p> :
              pending.map(c => <ContentRow key={c.id} c={c} onOpen={() => setDetail(c)} cta />)}
          </Section>
          {others.length > 0 && (
            <Section title="Recent">
              {others.map(c => <ContentRow key={c.id} c={c} onOpen={() => setDetail(c)} />)}
            </Section>
          )}
        </>
      )}

      {detail && ctx && <ContentDetail content={detail} role="client" ctx={ctx} onChanged={refresh} onClose={() => setDetail(null)} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 11 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function ContentRow({ c, onOpen, cta }: { c: ContentItem; onOpen: () => void; cta?: boolean }) {
  const m = STATUS_META[c.status]
  return (
    <div onClick={onOpen} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{c.title}</p>
        <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{typeLabel(c.content_type)} · {platformLabel(c.platform)}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Badge variant={m.badge}>{m.label}</Badge>
        {cta ? <Button variant="primary" size="sm">Review</Button> : <span style={{ fontSize: 18, color: 'var(--muted)' }}>›</span>}
      </div>
    </div>
  )
}
