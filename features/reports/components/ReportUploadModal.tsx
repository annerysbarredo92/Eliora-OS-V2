import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ActiveToggle } from '@/features/operations/components/ServiceModal'
import { formatBytes } from '@/lib/storage'
import type { Client } from '@/types'
import type { ReportMeta } from '../api'

interface ReportUploadModalProps {
  open: boolean
  clients: Client[]
  lockedClientId?: string
  onClose: () => void
  onSubmit: (file: File, meta: ReportMeta) => Promise<void>
}

export function ReportUploadModal({ open, clients, lockedClientId, onClose, onSubmit }: ReportUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<ReportMeta>({ client_id: lockedClientId ?? '', title: '', period_label: '', description: '', is_client_visible: true })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setFile(null); setMeta({ client_id: lockedClientId ?? clients[0]?.id ?? '', title: '', period_label: '', description: '', is_client_visible: true }); setError(null) }
  }, [open, lockedClientId, clients])

  function set<K extends keyof ReportMeta>(k: K, v: ReportMeta[K]) { setMeta(s => ({ ...s, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!meta.client_id) { setError('Choose a client.'); return }
    if (!meta.title.trim()) { setError('Title is required.'); return }
    if (!file) { setError('Choose a report file to upload.'); return }
    setSubmitting(true); setError(null)
    try { await onSubmit(file, meta); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.') }
    finally { setSubmitting(false) }
  }

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="Upload report" subtitle="Share a finished report with your client." width={560}
      footer={<><Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button><Button variant="primary" type="submit" form="report-form" loading={submitting}>Upload report</Button></>}>
      <form id="report-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!lockedClientId && <Select label="Client" value={meta.client_id} onChange={e => set('client_id', e.target.value)} options={[{ value: '', label: 'Select a client…' }, ...clients.map(c => ({ value: c.id, label: c.business_name }))]} />}
        <Input label="Title" value={meta.title} onChange={e => set('title', e.target.value)} placeholder="March 2026 Performance" autoFocus required />
        <Input label="Reporting period" value={meta.period_label} onChange={e => set('period_label', e.target.value)} placeholder="Mar 1 – Mar 31, 2026" />
        <Textarea label="Description" value={meta.description} onChange={e => set('description', e.target.value)} rows={2} />

        <div className="flex flex-col gap-[7px]">
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Report file</label>
          <input ref={fileRef} type="file" accept=".pdf,.csv,.xlsx,.docx,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', border: '1px dashed var(--hairline)', borderRadius: 14, background: 'var(--bg)', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', color: file ? 'var(--ink)' : 'var(--muted)', fontSize: 13.5 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
            {file ? `${file.name} · ${formatBytes(file.size)}` : 'Choose a file (PDF, CSV, XLSX, DOCX, image)'}
          </button>
        </div>

        <ActiveToggle checked={meta.is_client_visible} onChange={v => set('is_client_visible', v)} label="Visible to client" />
        {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(232,97,122,0.2)' }}>{error}</div>}
      </form>
    </Modal>
  )
}
