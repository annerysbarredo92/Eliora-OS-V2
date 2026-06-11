import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import {
  createClient, updateClient, archiveClient, clientToFormValues,
} from '@/features/clients/api'
import {
  primaryContact, contactName, statusLabel, STATUS_BADGE, STATUS_OPTIONS,
  HEALTH_LABEL, HEALTH_BADGE, relativeTime,
} from '@/features/clients/helpers'
import { ClientFormModal } from '@/features/clients/components/ClientFormModal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import { Modal } from '@/components/ui/Modal'
import type { Client, ClientStatus } from '@/types'
import type { ClientFormValues } from '@/features/clients/api'

type StatusFilter = ClientStatus | 'all'

export function AgencyClients() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { clients, metrics, loading, error, refresh } = useClients()

  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<StatusFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget]       = useState<Client | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null)
  const [archiving, setArchiving] = useState(false)

  const ctx = profile?.agency_id && profile?.id
    ? { agencyId: profile.agency_id, actorId: profile.id }
    : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter(c => {
      if (filter !== 'all' && c.status !== filter) return false
      if (!q) return true
      const pc = primaryContact(c)
      const hay = [
        c.business_name, c.industry ?? '', pc ? `${pc.first_name} ${pc.last_name}` : '',
        pc?.email ?? '', pc?.phone ?? '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [clients, search, filter])

  async function handleCreate(values: ClientFormValues) {
    if (!ctx) throw new Error('No agency context')
    await createClient(values, ctx)
    await refresh()
  }

  async function handleEdit(values: ClientFormValues) {
    if (!ctx || !editTarget) throw new Error('No edit context')
    await updateClient(editTarget.id, values, ctx)
    await refresh()
  }

  async function handleArchive() {
    if (!ctx || !archiveTarget) return
    setArchiving(true)
    try {
      await archiveClient(archiveTarget, ctx)
      await refresh()
      setArchiveTarget(null)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 6 }}>
            Client Center
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>
            Manage your clients, onboarding, and relationships.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add client
        </Button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Total Clients"  value={metrics.total}      accent="violet" />
        <KpiCard label="Active"         value={metrics.active}     accent="success" />
        <KpiCard label="Onboarding"     value={metrics.onboarding} accent="gold" />
        <KpiCard label="Archived"       value={metrics.archived}   accent="muted" />
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients, contacts, email…"
            style={{
              width: '100%', height: 46, paddingLeft: 40, paddingRight: 14,
              fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--ink)',
              background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
              borderRadius: 14, outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.boxShadow = '0 0 0 4px var(--lavender-soft)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', ...STATUS_OPTIONS.map(s => s.value)] as StatusFilter[]).map(f => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
                  border: '1px solid', transition: 'all 150ms ease',
                  borderColor: active ? 'var(--violet)' : 'var(--hairline)',
                  background: active ? 'var(--violet)' : 'var(--surface-solid)',
                  color: active ? '#fff' : 'var(--ink-2)',
                }}
              >
                {f === 'all' ? 'All' : statusLabel(f as ClientStatus)}
              </button>
            )
          })}
        </div>
      </div>

      {/* States */}
      {error && (
        <div style={{ fontSize: 13.5, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(232,97,122,0.2)', marginBottom: 16 }}>
          {error} — make sure the Phase 02 SQL has been run in Supabase.
        </div>
      )}

      {loading ? (
        <SkeletonTable />
      ) : filtered.length === 0 ? (
        <EmptyState hasClients={clients.length > 0} onAdd={() => setShowCreate(true)} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="client-table-wrap" style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {['Business', 'Primary Contact', 'Email', 'Phone', 'Status', 'Package', 'Portal', 'Health', 'Last Activity', ''].map(h => (
                    <th key={h} style={{ padding: '14px 16px', fontWeight: 700, borderBottom: '1px solid var(--hairline-2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const pc = primaryContact(c)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/agency/clients/${c.id}`)}
                      style={{ cursor: 'pointer', transition: 'background 120ms ease' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--lavender-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={cellStyle}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.business_name}</span>{c.industry && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{c.industry}</span>}</td>
                      <td style={cellStyle}>{contactName(pc)}</td>
                      <td style={{ ...cellStyle, color: 'var(--ink-2)' }}>{pc?.email || '—'}</td>
                      <td style={{ ...cellStyle, color: 'var(--ink-2)' }}>{pc?.phone || '—'}</td>
                      <td style={cellStyle}><Badge variant={STATUS_BADGE[c.status]}>{statusLabel(c.status)}</Badge></td>
                      <td style={{ ...cellStyle, color: 'var(--muted)' }}>{c.package_name || '—'}</td>
                      <td style={cellStyle}><Badge variant={c.portal_enabled ? 'success' : 'default'}>{c.portal_enabled ? 'Enabled' : 'Off'}</Badge></td>
                      <td style={cellStyle}><Badge variant={HEALTH_BADGE[c.health]}>{HEALTH_LABEL[c.health]}</Badge></td>
                      <td style={{ ...cellStyle, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{relativeTime(c.last_activity_at)}</td>
                      <td style={cellStyle} onClick={e => e.stopPropagation()}>
                        <RowActions
                          onOpen={() => navigate(`/agency/clients/${c.id}`)}
                          onEdit={() => setEditTarget(c)}
                          onArchive={() => setArchiveTarget(c)}
                          archived={c.status === 'archived'}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="client-cards" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
            {filtered.map(c => {
              const pc = primaryContact(c)
              return (
                <div key={c.id} onClick={() => navigate(`/agency/clients/${c.id}`)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>{c.business_name}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{contactName(pc)}{pc?.email ? ` · ${pc.email}` : ''}</p>
                    </div>
                    <Badge variant={STATUS_BADGE[c.status]}>{statusLabel(c.status)}</Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{relativeTime(c.last_activity_at)}</span>
                    <span onClick={e => e.stopPropagation()}>
                      <RowActions onOpen={() => navigate(`/agency/clients/${c.id}`)} onEdit={() => setEditTarget(c)} onArchive={() => setArchiveTarget(c)} archived={c.status === 'archived'} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Create modal */}
      <ClientFormModal open={showCreate} mode="create" onClose={() => setShowCreate(false)} onSubmit={handleCreate} />

      {/* Edit modal */}
      <ClientFormModal
        open={!!editTarget}
        mode="edit"
        initial={editTarget ? clientToFormValues(editTarget) : undefined}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />

      {/* Archive confirm */}
      <Modal
        open={!!archiveTarget}
        onClose={() => (archiving ? undefined : setArchiveTarget(null))}
        title="Archive client?"
        subtitle={archiveTarget ? `${archiveTarget.business_name} will be moved to archived. No data is deleted.` : ''}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveTarget(null)} disabled={archiving}>Cancel</Button>
            <Button variant="danger" onClick={handleArchive} loading={archiving}>Archive client</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          You can still find archived clients using the <strong>Archived</strong> filter, and reactivate them by editing their status.
        </p>
      </Modal>

      <style>{`
        @media (max-width: 880px) {
          .client-table-wrap { display: none; }
          .client-cards { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

const cellStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--hairline-2)',
  color: 'var(--ink)',
  verticalAlign: 'middle',
}

function RowActions({ onOpen, onEdit, onArchive, archived }: { onOpen: () => void; onEdit: () => void; onArchive: () => void; archived: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Actions"
        style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--hairline)', background: 'var(--surface-solid)', color: 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 38, zIndex: 30, minWidth: 184, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 6 }}>
          <MenuItem label="Open profile" onClick={onOpen} />
          <MenuItem label="Edit" onClick={onEdit} />
          <div style={{ height: 1, background: 'var(--hairline-2)', margin: '5px 0' }} />
          <MenuItem label="Send invite" muted />
          <MenuItem label="Create content" muted />
          <MenuItem label="Upload files" muted />
          <MenuItem label="Create report" muted />
          {!archived && (
            <>
              <div style={{ height: 1, background: 'var(--hairline-2)', margin: '5px 0' }} />
              <MenuItem label="Archive" onClick={onArchive} danger />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, onClick, muted, danger }: { label: string; onClick?: () => void; muted?: boolean; danger?: boolean }) {
  return (
    <button
      onMouseDown={onClick}
      disabled={muted}
      title={muted ? 'Coming in a later phase' : undefined}
      style={{
        width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: 'none',
        background: 'transparent', cursor: muted ? 'not-allowed' : 'pointer',
        fontSize: 13.5, fontFamily: 'var(--font-sans)',
        color: danger ? 'var(--danger)' : muted ? 'var(--muted)' : 'var(--ink)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
      onMouseEnter={e => { if (!muted) e.currentTarget.style.background = 'var(--lavender-soft)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {label}{muted && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Soon</span>}
    </button>
  )
}

function SkeletonTable() {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: 40, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />
      ))}
    </div>
  )
}

function EmptyState({ hasClients, onAdd }: { hasClients: boolean; onAdd: () => void }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '56px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        {hasClients ? 'No clients match your filters' : 'No clients yet'}
      </p>
      <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, margin: '0 auto 22px', lineHeight: 1.6 }}>
        {hasClients ? 'Try a different search or status filter.' : 'Add your first client to start building your roster and tracking activity.'}
      </p>
      {!hasClients && <Button variant="primary" onClick={onAdd}>Add your first client</Button>}
    </div>
  )
}
