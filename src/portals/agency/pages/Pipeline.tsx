import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProjects, useProjectStages } from '@/features/projects/hooks'
import { createProject, checkProposalExpiry, moveProjectStage, updateProjectFields } from '@/features/projects/api'
import { archiveClient } from '@/features/clients/api'
import { money } from '@/features/operations/helpers'
import { primaryContact, contactName, relativeTime, HEALTH_LABEL } from '@/features/clients/helpers'
import { STAGE_COLORS, sortProjects } from '@/features/projects/helpers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/Menu'
import type { Client } from '@/types'
import type { ProjectFormValues } from '@/features/projects/api'
import type { SortKey, SortDir } from '@/features/projects/helpers'

const LEAD_SOURCES = ['Referral', 'Website', 'Social Media', 'Cold Outreach', 'Event', 'Partnership', 'Other']

// Maps URL ?health param → DB health column value
const HEALTH_PARAM_TO_DB: Record<string, string> = {
  healthy:         'healthy',
  needs_attention: 'at_risk',
  at_risk:         'critical',
}

export function AgencyProjects() {
  const { profile }    = useAuth()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  const { projects, loading, refresh: refreshProjects }       = useProjects()
  const { stages, summary, loading: stagesLoading, refresh: refreshStages } = useProjectStages()

  const [filterStage, setFilterStage]   = useState<string | null>(null)
  const [filterHealth, setFilterHealth] = useState<string | null>(
    () => {
      const p = searchParams.get('health')
      return p ? (HEALTH_PARAM_TO_DB[p] ?? null) : null
    },
  )
  const [search, setSearch]             = useState('')
  const [sortKey, setSortKey]           = useState<SortKey | null>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [showCreate, setShowCreate]     = useState(() => searchParams.get('create') === 'true')
  const [editTarget, setEditTarget]     = useState<Client | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null)
  const [archiving, setArchiving]         = useState(false)
  const [movingStage, setMovingStage]   = useState<Record<string, boolean>>({})

  const ctx = profile?.agency_id && profile?.id
    ? { agencyId: profile.agency_id, actorId: profile.id }
    : null

  // ── Filtering ──────────────────────────────────────────────────────────────
  const q = search.toLowerCase()

  const filtered = projects.filter(p => {
    if (filterStage && p.stage_id !== filterStage) return false
    if (filterHealth && p.health !== filterHealth) return false
    if (q) {
      const pc = primaryContact(p)
      const name = contactName(pc).toLowerCase()
      const fields = [
        p.business_name,
        name,
        pc?.email ?? '',
        pc?.phone ?? '',
        p.industry ?? '',
        p.next_action ?? '',
      ]
      if (!fields.some(f => f.toLowerCase().includes(q))) return false
    }
    return true
  })

  const sorted = sortProjects(filtered, sortKey, sortDir, summary)

  // Active clients sub-section (status = active, shown at bottom regardless of stage filter)
  const activeClients = projects.filter(p => p.status === 'active')

  // ── Sort toggle ────────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span style={{ opacity: 0.25, fontSize: 9 }}>↕</span>
    return <span style={{ fontSize: 9, color: 'var(--violet)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Health click ───────────────────────────────────────────────────────────
  function toggleHealthFilter(dbValue: string) {
    setFilterHealth(prev => prev === dbValue ? null : dbValue)
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  async function handleCreate(values: ProjectFormValues) {
    if (!ctx) return
    await createProject(values, ctx)
    await checkProposalExpiry()
    await Promise.all([refreshProjects(), refreshStages()])
  }

  async function handleStageChange(project: Client, stageId: string) {
    if (!ctx || project.stage_id === stageId) return
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return
    setMovingStage(m => ({ ...m, [project.id]: true }))
    try {
      await moveProjectStage(project.id, stageId, stage.name, ctx)
      await Promise.all([refreshProjects(), refreshStages()])
    } finally {
      setMovingStage(m => ({ ...m, [project.id]: false }))
    }
  }

  async function handleEdit(projectId: string, patch: Record<string, unknown>) {
    if (!ctx) return
    await updateProjectFields(projectId, patch, ctx)
    await refreshProjects()
  }

  async function handleArchive() {
    if (!ctx || !archiveTarget) return
    setArchiving(true)
    try {
      await archiveClient(archiveTarget, ctx)
      setArchiveTarget(null)
      await Promise.all([refreshProjects(), refreshStages()])
    } finally { setArchiving(false) }
  }

  const hasActiveFilters = filterStage || filterHealth || search

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

      {/* ── Search + filter bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 280px', maxWidth: 380 }}>
          <Input
            label=""
            placeholder="Search by name, contact, email, industry…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Health filter chips */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['healthy', 'at_risk', 'critical'] as const).map(h => {
            const active = filterHealth === h
            const colors: Record<string, { bg: string; border: string; text: string }> = {
              healthy:  { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46' },
              at_risk:  { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E' },
              critical: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
            }
            const c = colors[h]
            return (
              <button
                key={h}
                onClick={() => toggleHealthFilter(h)}
                style={{
                  fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  background: active ? c.bg : 'var(--surface-solid)',
                  border: `1.5px solid ${active ? c.border : 'var(--hairline)'}`,
                  color: active ? c.text : 'var(--muted)',
                  cursor: 'pointer', transition: 'all 120ms ease', fontFamily: 'var(--font-sans)',
                }}
              >
                {HEALTH_LABEL[h]}
              </button>
            )
          })}
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterStage(null); setFilterHealth(null); setSearch('') }}
              style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontFamily: 'var(--font-sans)' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Project list ── */}
      {loading ? (
        <LoadingSkel />
      ) : sorted.length === 0 ? (
        <Empty
          title={projects.length === 0 ? 'No projects yet' : 'No results'}
          body={projects.length === 0
            ? 'Click ＋ New Project to add your first lead or client.'
            : 'No projects match your current filters. Try clearing the search or filters above.'}
          action={hasActiveFilters
            ? <Button variant="ghost" size="sm" onClick={() => { setFilterStage(null); setFilterHealth(null); setSearch('') }}>Clear filters</Button>
            : <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>＋ New Project</Button>}
        />
      ) : (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 32 }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.4fr 1fr 1fr 1fr 40px', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface)' }}>
            {(
              [
                { label: 'Project',       key: 'name'     as SortKey | null },
                { label: 'Contact',       key: null },
                { label: 'Stage',         key: 'stage'    as SortKey | null },
                { label: 'Value',         key: 'value'    as SortKey | null },
                { label: 'Last Activity', key: 'activity' as SortKey | null },
                { label: 'Next Action',   key: null },
                { label: '',              key: null },
              ] as { label: string; key: SortKey | null }[]
            ).map(({ label, key }) => (
              <span
                key={label}
                onClick={key ? () => toggleSort(key) : undefined}
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: sortKey === key ? 'var(--violet)' : 'var(--muted)',
                  cursor: key ? 'pointer' : 'default',
                  userSelect: 'none', display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                {label}
                {key && sortIndicator(key)}
              </span>
            ))}
          </div>

          {sorted.map((p, i) => {
            const pc    = primaryContact(p)
            const stage = p.pipeline_stages
            const color = stage ? (STAGE_COLORS[stage.name] ?? 'var(--violet)') : 'var(--muted)'
            const health = p.health as keyof typeof HEALTH_LABEL
            const isMoving = !!movingStage[p.id]

            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.3fr 1.4fr 1fr 1fr 1fr 40px',
                  gap: 0,
                  padding: '12px 16px',
                  borderBottom: i < sorted.length - 1 ? '1px solid var(--hairline-2)' : 'none',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => navigate(`/agency/projects/${p.id}`)}
              >
                {/* Business name + health badge */}
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: health && health !== 'unknown' ? 3 : 0 }}>{p.business_name}</p>
                  {health && health !== 'unknown' && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleHealthFilter(health) }}
                      style={{
                        fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                        background: filterHealth === health
                          ? (health === 'healthy' ? '#ECFDF5' : health === 'at_risk' ? '#FFFBEB' : '#FEF2F2')
                          : 'transparent',
                        border: `1px solid ${health === 'healthy' ? '#6EE7B7' : health === 'at_risk' ? '#FCD34D' : '#FECACA'}`,
                        color: health === 'healthy' ? '#065F46' : health === 'at_risk' ? '#92400E' : '#991B1B',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {HEALTH_LABEL[health] ?? health}
                    </button>
                  )}
                </div>

                {/* Primary contact */}
                <div>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{contactName(pc)}</p>
                  {pc?.email && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{pc.email}</p>}
                </div>

                {/* Stage dropdown */}
                <div onClick={e => e.stopPropagation()} style={{ opacity: isMoving ? 0.5 : 1 }}>
                  <select
                    value={p.stage_id ?? ''}
                    disabled={isMoving || !ctx}
                    onChange={e => handleStageChange(p, e.target.value)}
                    style={{
                      fontSize: 11.5, fontWeight: 600, padding: '3px 8px',
                      color: color,
                      background: `${color}18`,
                      border: `1.5px solid ${color}40`,
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      appearance: 'auto',
                      maxWidth: 160,
                    }}
                  >
                    <option value="" disabled>No stage</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
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
                    { label: 'Open Workspace',  onClick: () => navigate(`/agency/projects/${p.id}`) },
                    { label: 'Edit Project',    onClick: () => setEditTarget(p) },
                    { label: 'Archive Project', onClick: () => setArchiveTarget(p), danger: true },
                  ]} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Active Clients section ── */}
      {!loading && activeClients.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted)' }}>Active Clients</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 999, padding: '1px 8px' }}>{activeClients.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {activeClients.map(p => {
              const pc = primaryContact(p)
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/agency/projects/${p.id}`)}
                  style={{
                    textAlign: 'left', padding: '12px 14px',
                    background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
                    borderRadius: 12, cursor: 'pointer',
                    transition: 'border-color 140ms ease, box-shadow 140ms ease',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#A78BFA'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 3px #7C3AED10' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--hairline)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{p.business_name}</p>
                  {pc && <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{contactName(pc)}</p>}
                  {p.project_value_cents > 0 && (
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginTop: 6 }}>{money(p.project_value_cents)}</p>
                  )}
                  {p.next_action && (
                    <p style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {p.next_action}</p>
                  )}
                </button>
              )
            })}
          </div>
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

      {ctx && editTarget && (
        <EditProjectModal
          project={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={async patch => { await handleEdit(editTarget.id, patch); setEditTarget(null) }}
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

// ── New Project Modal ────────────────────────────────────────────────────────

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
          <Input label="Contact last name"  value={form.contact_last_name}  onChange={e => set('contact_last_name', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Contact email" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          <Input label="Contact phone"             value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
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

// ── Edit Project Modal ───────────────────────────────────────────────────────

interface EditPatch {
  business_name: string
  project_value_cents: number
  industry: string
  website: string
  location: string
  next_action: string
  lead_source: string
}

function EditProjectModal({ project, onClose, onSubmit }: {
  project: Client
  onClose: () => void
  onSubmit: (patch: Record<string, unknown>) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<EditPatch>({
    business_name:        project.business_name,
    project_value_cents:  project.project_value_cents ?? 0,
    industry:             project.industry ?? '',
    website:              project.website ?? '',
    location:             project.location ?? '',
    next_action:          project.next_action ?? '',
    lead_source:          project.lead_source ?? '',
  })

  function set<K extends keyof EditPatch>(k: K, v: EditPatch[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit({ ...form }) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${project.business_name}`} width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="edit-project" loading={busy}>Save Changes</Button></>}
    >
      <form id="edit-project" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Business name *" value={form.business_name} onChange={e => set('business_name', e.target.value)} autoFocus required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Project value ($)" type="number" min={0}
            value={form.project_value_cents / 100 || ''}
            onChange={e => set('project_value_cents', Math.round(parseFloat(e.target.value || '0') * 100))} />
          <Select label="Lead source" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}
            options={[{ value: '', label: 'Select source…' }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} />
          <Input label="Location"  value={form.location}  onChange={e => set('location', e.target.value)} />
        </div>
        <Input label="Website" type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
        <Input label="Next action" value={form.next_action} onChange={e => set('next_action', e.target.value)} placeholder="e.g. Follow up after call" />
      </form>
    </Modal>
  )
}

// ── Skeleton + Empty ─────────────────────────────────────────────────────────

function LoadingSkel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: 56, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.4 }} />
      ))}
    </div>
  )
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
      padding: '52px 24px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: action ? 20 : 0, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>{body}</p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}
