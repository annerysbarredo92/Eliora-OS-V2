import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClient } from '@/features/clients/hooks'
import { useActivity } from '@/features/activity/hooks'
import {
  updateClient, archiveClient, clientToFormValues,
} from '@/features/clients/api'
import {
  primaryContact, contactName, statusLabel, STATUS_BADGE,
  HEALTH_LABEL, relativeTime,
} from '@/features/clients/helpers'
import { ClientFormModal } from '@/features/clients/components/ClientFormModal'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { ClientFormValues } from '@/features/clients/api'

const TABS = [
  { id: 'overview',   label: 'Overview',   live: true },
  { id: 'content',    label: 'Content',    live: false },
  { id: 'files',      label: 'Files',      live: false },
  { id: 'reports',    label: 'Reports',    live: false },
  { id: 'billing',    label: 'Billing',    live: false },
  { id: 'messages',   label: 'Messages',   live: false },
  { id: 'onboarding', label: 'Onboarding', live: false },
  { id: 'activity',   label: 'Activity',   live: true },
  { id: 'settings',   label: 'Settings',   live: true },
]

export function AgencyClientProfile() {
  const { clientId } = useParams<{ clientId: string }>()
  const { profile } = useAuth()
  const { client, loading, error, refresh } = useClient(clientId)
  const activity = useActivity({ clientId, limit: 50 })

  const [tab, setTab] = useState('overview')
  const [editing, setEditing]   = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const ctx = profile?.agency_id && profile?.id
    ? { agencyId: profile.agency_id, actorId: profile.id }
    : null

  async function handleEdit(values: ClientFormValues) {
    if (!ctx || !client) throw new Error('No context')
    await updateClient(client.id, values, ctx)
    await refresh()
    await activity.refresh()
  }

  async function handleArchive() {
    if (!ctx || !client) return
    setArchiving(true)
    try {
      await archiveClient(client, ctx)
      await refresh()
      await activity.refresh()
      setArchiveOpen(false)
    } finally {
      setArchiving(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ height: 90, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.5 }} />
        <div style={{ height: 300, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="animate-fade-up" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Client not found</p>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
          {error ? `${error}` : 'This client may have been removed, or you do not have access.'}
        </p>
        <Link to="/agency/clients"><Button variant="primary">Back to Client Center</Button></Link>
      </div>
    )
  }

  const pc = primaryContact(client)

  return (
    <div className="animate-fade-up">
      {/* Breadcrumb */}
      <Link to="/agency/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--muted)', textDecoration: 'none', marginBottom: 16, fontWeight: 500 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        Client Center
      </Link>

      {/* Header */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#6D3DE6,#9258EE)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
              {client.business_name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{client.business_name}</h1>
                <Badge variant={STATUS_BADGE[client.status]}>{statusLabel(client.status)}</Badge>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
                {client.industry || 'No industry set'} · {contactName(pc)}{pc?.email ? ` · ${pc.email}` : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            {client.status !== 'archived' && (
              <Button variant="ghost" onClick={() => setArchiveOpen(true)}>Archive</Button>
            )}
          </div>
        </div>

        {/* Snapshot cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 22 }}>
          <Snapshot label="Status" value={statusLabel(client.status)} />
          <Snapshot label="Portal Status" value={client.portal_enabled ? 'Enabled' : 'Off'} />
          <Snapshot label="Package" value={client.package_name || '—'} soon />
          <Snapshot label="Health" value={HEALTH_LABEL[client.health]} soon={client.health === 'unknown'} />
          <Snapshot label="Last Activity" value={relativeTime(client.last_activity_at)} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 22, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 16px', fontSize: 13.5, fontFamily: 'var(--font-sans)',
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--violet)' : 'var(--ink-2)',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: tab === t.id ? '2px solid var(--violet)' : '2px solid transparent',
              marginBottom: -1, letterSpacing: '-0.01em',
            }}
          >
            {t.label}{!t.live && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>soon</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20 }} className="profile-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel title="Business Information">
              <InfoRow label="Business name" value={client.business_name} />
              <InfoRow label="Industry" value={client.industry} />
              <InfoRow label="Website" value={client.website} link />
              <InfoRow label="Phone" value={client.business_phone} />
              <InfoRow label="Address" value={client.business_address} />
            </Panel>
            <Panel title="Primary Contact">
              <InfoRow label="Name" value={contactName(pc)} />
              <InfoRow label="Email" value={pc?.email ?? null} />
              <InfoRow label="Phone" value={pc?.phone ?? null} />
            </Panel>
            <Panel title="Internal Notes">
              <p style={{ fontSize: 14, color: client.internal_notes ? 'var(--ink-2)' : 'var(--muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {client.internal_notes || 'No internal notes yet.'}
              </p>
            </Panel>
          </div>
          <Panel title="Recent Activity">
            <ActivityFeed items={activity.items.slice(0, 8)} loading={activity.loading} />
          </Panel>
        </div>
      )}

      {tab === 'activity' && (
        <Panel title="Activity">
          <ActivityFeed items={activity.items} loading={activity.loading} emptyLabel="No activity recorded for this client yet." />
        </Panel>
      )}

      {tab === 'settings' && (
        <Panel title="Client Settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <InfoRow label="Business name" value={client.business_name} />
            <InfoRow label="Industry" value={client.industry} />
            <InfoRow label="Status" value={statusLabel(client.status)} />
            <InfoRow label="Primary contact" value={contactName(pc)} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <Button variant="primary" onClick={() => setEditing(true)}>Edit client info</Button>
            {client.status !== 'archived' && <Button variant="ghost" onClick={() => setArchiveOpen(true)}>Archive client</Button>}
          </div>
        </Panel>
      )}

      {!['overview', 'activity', 'settings'].includes(tab) && (
        <Panel title={TABS.find(t => t.id === tab)?.label ?? ''}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Badge variant="default" style={{ marginBottom: 12 }}>Coming soon</Badge>
            <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
              {TABS.find(t => t.id === tab)?.label} for this client arrives in a later phase. The Client Center, profile, and activity log are live now.
            </p>
          </div>
        </Panel>
      )}

      {/* Edit + archive */}
      <ClientFormModal open={editing} mode="edit" initial={clientToFormValues(client)} onClose={() => setEditing(false)} onSubmit={handleEdit} />
      <Modal
        open={archiveOpen}
        onClose={() => (archiving ? undefined : setArchiveOpen(false))}
        title="Archive client?"
        subtitle={`${client.business_name} will be moved to archived. No data is deleted.`}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={archiving}>Cancel</Button>
            <Button variant="danger" onClick={handleArchive} loading={archiving}>Archive client</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Archived clients stay in your records and can be reactivated anytime by editing their status.
        </p>
      </Modal>

      <style>{`@media (max-width: 860px){ .profile-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function Snapshot({ label, value, soon }: { label: string; value: string; soon?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', position: 'relative' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{value}</p>
      {soon && <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>soon</span>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 22 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>{title}</h3>
      {children}
    </section>
  )
}

function InfoRow({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  const display = value && value.trim() ? value : '—'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--hairline-2)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      {link && value
        ? <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, color: 'var(--violet)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</a>
        : <span style={{ fontSize: 13.5, color: display === '—' ? 'var(--muted)' : 'var(--ink)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{display}</span>}
    </div>
  )
}
