import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { AiBrief } from '@/features/ai/components/AiBrief'
import { CONTENT_TYPE_OPTIONS, PLATFORM_OPTIONS } from '../helpers'
import type { ContentFormValues } from '../api'
import type { Client } from '@/types'

const empty = (clientId: string): ContentFormValues => ({
  client_id: clientId, title: '', content_type: 'static_post', platform: 'instagram',
  campaign: '', caption: '', cta: '', hashtags: '', scheduled_date: '', status: 'draft',
  internal_notes: '', client_notes: '',
})

interface ContentModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: ContentFormValues
  clients: Client[]
  lockedClientId?: string
  onClose: () => void
  onSubmit: (v: ContentFormValues) => Promise<void>
}

export function ContentModal({ open, mode, initial, clients, lockedClientId, onClose, onSubmit }: ContentModalProps) {
  const { profile } = useAuth()
  const [v, setV] = useState<ContentFormValues>(initial ?? empty(lockedClientId ?? ''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const aiCtx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id, clientId: v.client_id || null } : null

  useEffect(() => {
    if (open) { setV(initial ?? empty(lockedClientId ?? clients[0]?.id ?? '')); setError(null) }
  }, [open, initial, lockedClientId, clients])

  function set<K extends keyof ContentFormValues>(k: K, val: ContentFormValues[K]) { setV(s => ({ ...s, [k]: val })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!v.client_id) { setError('Choose a client.'); return }
    if (!v.title.trim()) { setError('Title is required.'); return }
    setSubmitting(true); setError(null)
    try { await onSubmit(v); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') }
    finally { setSubmitting(false) }
  }

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose}
      title={mode === 'create' ? 'Create content' : 'Edit content'}
      subtitle="Plan a post and send it for client review when ready." width={640}
      footer={<>
        <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" form="content-form" loading={submitting}>{mode === 'create' ? 'Create' : 'Save changes'}</Button>
      </>}>
      <form id="content-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!lockedClientId && (
          <Select label="Client" value={v.client_id} onChange={e => set('client_id', e.target.value)}
            options={[{ value: '', label: 'Select a client…' }, ...clients.map(c => ({ value: c.id, label: c.business_name }))]} />
        )}
        <Input label="Title" value={v.title} onChange={e => set('title', e.target.value)} placeholder="Spring launch teaser" autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Select label="Content type" value={v.content_type} onChange={e => set('content_type', e.target.value as ContentFormValues['content_type'])} options={CONTENT_TYPE_OPTIONS} />
          <Select label="Platform" value={v.platform} onChange={e => set('platform', e.target.value as ContentFormValues['platform'])} options={PLATFORM_OPTIONS} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="Campaign (optional)" value={v.campaign} onChange={e => set('campaign', e.target.value)} />
          <Input label="Scheduled date (optional)" type="datetime-local" value={v.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Caption</span>
            {aiCtx && <button type="button" onClick={() => setAiOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--violet)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>✦ {aiOpen ? 'Hide AI assist' : 'AI assist'}</button>}
          </div>
          <Textarea label="" value={v.caption} onChange={e => set('caption', e.target.value)} rows={3} />
          {aiOpen && aiCtx && (
            <div style={{ marginTop: 12, padding: 14, border: '1px solid var(--hairline)', borderRadius: 14, background: 'var(--bg)' }}>
              <AiBrief ctx={aiCtx} compact onUseCaption={c => set('caption', c)} onUseHashtags={h => set('hashtags', h)} />
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Input label="CTA" value={v.cta} onChange={e => set('cta', e.target.value)} placeholder="Shop now" />
          <Input label="Hashtags (optional)" value={v.hashtags} onChange={e => set('hashtags', e.target.value)} placeholder="#spring #launch" />
        </div>
        <Textarea label="Client-visible notes" value={v.client_notes} onChange={e => set('client_notes', e.target.value)} rows={2} hint="Shown to the client." />
        <Textarea label="Internal notes" value={v.internal_notes} onChange={e => set('internal_notes', e.target.value)} rows={2} hint="Never shown to the client." />
        {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>{error}</div>}
      </form>
    </Modal>
  )
}

export function contentToForm(c: import('@/types').ContentItem): ContentFormValues {
  return {
    client_id: c.client_id, title: c.title, content_type: c.content_type, platform: c.platform,
    campaign: c.campaign ?? '', caption: c.caption ?? '', cta: c.cta ?? '', hashtags: c.hashtags ?? '',
    scheduled_date: c.scheduled_date ? c.scheduled_date.slice(0, 16) : '', status: c.status,
    internal_notes: c.internal_notes ?? '', client_notes: c.client_notes ?? '',
  }
}
