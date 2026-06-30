import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProjects, useProjectStages } from '@/features/projects/hooks'
import { createProject, checkProposalExpiry } from '@/features/projects/api'
import { archiveClient } from '@/features/clients/api'
import { money } from '@/features/operations/helpers'
import { primaryContact, contactName, relativeTime } from '@/features/clients/helpers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/Menu'
import type { Client } from '@/types'
import type { ProjectFormValues } from '@/features/projects/api'

const LEAD_SOURCES = ['Referral', 'Website', 'Social Media', 'Cold Outreach', 'Event', 'Partnership', 'Other']

const STAGE_COLORS: Record<string, string> = {
  'New Inquiry / Lead': '#6D3DE6',
  'Discovery Call':     '#4F8EF7',
  'Proposal Sent':      '#F0A443',
  'Proposal Signed':    '#10B981',
  'Onboarding':         '#9258EE',
  'Client':             '#059669',
}

export function AgencyProjects() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const { projects, loading, refresh } = useProjects()
  const { stages, summary, loading: stagesLoading } = useProjectStages()

  const [filterStage, setFilterStage] = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [showCreate, setShowCreate]   = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null)
  const [archiving, setArchiving]         = useState(false)

  const ctx = profile?.agency_id && profile?.id
    ? { agencyId: profile.agency_id, actorId: profile.id }
    : null

  const filtered = projects.filter(p => {
    if (filterStage && p.stage_id !== filterStage) return false
    if (search && !p.business_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleCreate(values: ProjectFormValues) {
    if (!ctx) return
    await createProject(values, ctx)
    await checkProposalExpiry()
    refresh()
  }

  async function handleArchive() {
    if (!ctx || !archiveTarget) return
    setArchiving(true)
    try {
      await archiveClient(archiveTarget, ctx)
      setArchiveTarget(null)
      refresh()
    } finally { setArchiving(false) }
  }

  return (
    <div className="animate-fade-up">
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Projects</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your full client lifecycle — from first inquiry to active client.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>＋ New Project</Button>
      </div>

      {/* ── Pipeline summary cards ── */}
      {!stagesLoading && summary.length > 0 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
          {summary.map(s => {
            const active = filterStage === s.id
            const color  = STAGE_COLORS[s.name] ?? 'var(--violet)'
            return (
              <button
                key={s.id}
                onClick={() => setFilterStage(active ? null : s.id)}
                style={{
                  flexShrink: 0, minWidth: 140, padding: '12px 16px',
                  background: active ? color : 'var(--surface-solid)',
                  border: `1.5px solid ${active ? color : 'var(--hairline)'}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 160ms ease', fontFamily: 'var(--font-sans)',
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: active ? 'rgba(255,255,255,0.75)' : 'var(--muted)', marginBottom: 6 }}>{s.name}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: active ? '#fff' : 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 3 }}>{s.count}</p>
                <p style={{ fontSize: 11.5, color: active ? 'rgba(255,255,255,0.8)' : 'var(--muted)' }}>{money(s.total_cents)}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{ marginBottom: 16, maxWidth: 340 }}>
        <Input
          label=""
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Project list ── */}
      {loading ? (
        <LoadingSkel />
      ) : filtered.length === 0 ? (
        <Empty>
          {projects.length === 0
            ? 'No projects yet. Click ＋ New Project to add your first.'
            : 'No projects match your current filter.'}
        </Empty>
      ) : (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.2fr 1fr 1fr 1fr 40px', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface)' }}>
            {['Project', 'Contact', 'Stage', 'Value', 'Last Activity', 'Next Action', ''].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
            ))}
          </div>

          {filtered.map((p, i) => {
            const pc    = primaryContact(p)
            const stage = p.pipeline_stages
            const color = stage ? (STAGE_COLORS[stage.name] ?? 'var(--violet)') : 'var(--muted)'
            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 1.2fr 1fr 1fr 1fr 40px',
                  gap: 0,
                  padding: '13px 16px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--hairline-2)' : 'none',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => navigate(`/agency/projects/${p.id}`)}
              >
                {/* Business name + health */}
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{p.business_name}</p>
                  {p.health !== 'unknown' && (
                    <span style={{ fontSize: 10.5, color: p.health === 'healthy' ? '#059669' : p.health === 'at_risk' ? '#D97706' : '#DC2626', fontWeight: 600 }}>
                      {p.health}
                    </span>
                  )}
                </div>

                {/* Primary contact */}
                <div>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{contactName(pc) || '—'}</p>
                  {pc?.email && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{pc.email}</p>}
                </div>

                {/* Stage badge */}
                <div>
                  {stage ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11.5, fontWeight: 600, color: color,
                      background: `${color}18`, padding: '3px 8px', borderRadius: 999,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {stage.name}
                    </span>
                  ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                </div>

                {/* Value */}
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {p.project_value_cents > 0 ? money(p.project_value_cents) : '—'}
                </p>

                {/* Last activity */}
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>{relativeTime(p.last_activity_at)}</p>

                {/* Next action */}
                <p style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.next_action || '—'}
                </p>

                {/* Actions menu */}
                <div onClick={e => e.stopPropagation()}>
                  <ActionMenu items={[
                    { label: 'Open Workspace',   onClick: () => navigate(`/agency/projects/${p.id}`) },
                    { label: 'Archive Project',  onClick: () => setArchiveTarget(p), danger: true },
                  ]} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {ctx && showCreate && (
        <NewProjectModal
          stages={stages}
          onClose={() => setShowCreate(false)}
          onSubmit={async v => { await handleCreate(v); setShowCreate(false) }}
        />
      )}

      <Modal
        open={!!archiveTarget}
        onClose={() => archiving ? undefined : setArchiveTarget(null)}
        title="Archive project?"
        subtitle={`${archiveTarget?.business_name} will be archived. No data is deleted.`}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveTarget(null)} disabled={archiving}>Cancel</Button>
            <Button variant="danger" onClick={handleArchive} loading={archiving}>Archive</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Archived projects stay in your records and can be reactivated by editing their status inside the workspace.
        </p>
      </Modal>
    </div>
  )
}

function NewProjectModal({ stages, onClose, onSubmit }: {
  stages: Array<{ id: string; name: string }>
  onClose: () => void
  onSubmit: (v: ProjectFormValues) => Promise<void>
}) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<ProjectFormValues>({
    business_name: '', contact_first_name: '', contact_last_name: '',
    contact_email: '', contact_phone: '', lead_source: '',
    project_value_cents: 0, sales_owner_id: profile?.id ?? '',
    stage_id: stages[0]?.id ?? '', location: '', website: '', industry: '',
    next_action: '',
  })

  function set<K extends keyof ProjectFormValues>(k: K, v: ProjectFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(form) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="New Project" width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="new-project" loading={busy}>Create Project</Button></>}
    >
      <form id="new-project" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Business name *" value={form.business_name} onChange={e => set('business_name', e.target.value)} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Contact first name" value={form.contact_first_name} onChange={e => set('contact_first_name', e.target.value)} />
          <Input label="Contact last name" value={form.contact_last_name} onChange={e => set('contact_last_name', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Contact email" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          <Input label="Contact phone" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Select label="Stage" value={form.stage_id} onChange={e => set('stage_id', e.target.value)}
            options={stages.map(s => ({ value: s.id, label: s.name }))} />
          <Select label="Lead source" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}
            options={[{ value: '', label: 'Select source…' }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Project value ($)" type="number" min={0}
            value={form.project_value_cents / 100 || ''}
            onChange={e => set('project_value_cents', Math.round(parseFloat(e.target.value || '0') * 100))} />
          <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} />
        </div>
        <Input label="Next action" value={form.next_action} onChange={e => set('next_action', e.target.value)} placeholder="e.g. Send intro email" />
      </form>
    </Modal>
  )
}

function LoadingSkel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: 56, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.4 }} />
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
      {children}
    </div>
  )
}
