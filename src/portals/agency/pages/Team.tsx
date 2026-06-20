import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import * as T from '@/features/team/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { PermissionSet, TeamInvitation } from '@/types'

export function AgencyTeam() {
  const { profile } = useAuth()
  const [team, setTeam] = useState<T.TeamMember[]>([])
  const [sets, setSets] = useState<PermissionSet[]>([])
  const [invites, setInvites] = useState<TeamInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const agencyId = profile?.agency_id ?? null
  const ctx = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null

  const load = useCallback(async () => {
    if (!agencyId) return
    await T.seedPresets(agencyId)
    const [tm, ps, inv] = await Promise.all([T.listTeam(agencyId), T.listPermissionSets(), T.listInvitations()])
    setTeam(tm); setSets(ps); setInvites(inv); setLoading(false)
  }, [agencyId])
  useEffect(() => { load() }, [load])

  async function setPermSet(profileId: string, setId: string) { if (ctx) { await T.upsertMembership(profileId, { permission_set_id: setId || null }, ctx); await load() } }
  async function toggleActive(profileId: string, current: string) { if (ctx) { await T.setMemberStatus(profileId, current === 'deactivated' ? 'active' : 'deactivated', ctx); await load() } }

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Team</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your agency team, roles, and permissions.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>Invite member</Button>
      </div>

      {loading ? <Skel /> : (
        <>
          <p style={kicker}>Members</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {team.map(({ profile: p, membership }) => (
              <div key={p.id} style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(105deg,#6D3DE6,#9258EE)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{p.avatar_initials || '?'}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.display_name || p.email}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>{p.role.replace('_', ' ')}{membership?.title ? ` · ${membership.title}` : ''}</p>
                </div>
                <div style={{ width: 180 }}>
                  <Select value={membership?.permission_set_id ?? ''} onChange={e => setPermSet(p.id, e.target.value)} options={[{ value: '', label: 'No permission set' }, ...sets.map(s => ({ value: s.id, label: s.name }))]} />
                </div>
                <Badge variant={membership?.status === 'deactivated' ? 'default' : 'success'}>{membership?.status === 'deactivated' ? 'Deactivated' : 'Active'}</Badge>
                {p.role !== 'agency_owner' && p.id !== profile?.id && (
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(p.id, membership?.status ?? 'active')}>{membership?.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}</Button>
                )}
              </div>
            ))}
          </div>

          {invites.filter(i => i.status === 'pending').length > 0 && (
            <>
              <p style={kicker}>Pending Invitations</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {invites.filter(i => i.status === 'pending').map(i => (
                  <div key={i.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{i.email}</p><p style={{ fontSize: 12, color: 'var(--muted)' }}>{i.role.replace('_', ' ')}{i.title ? ` · ${i.title}` : ''}</p></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Badge variant="brand">Pending</Badge><Button variant="ghost" size="sm" onClick={() => T.setInviteStatus(i.id, 'revoked').then(load)}>Revoke</Button></div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p style={kicker}>Permission Sets</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {sets.map(s => (
              <div key={s.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 16 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{s.name}{s.is_preset && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>PRESET</span>}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{Object.keys(s.permissions).length} modules</p>
              </div>
            ))}
          </div>
        </>
      )}

      {ctx && <InviteModal open={showInvite} sets={sets} onClose={() => setShowInvite(false)} onSubmit={async (email, role, title, setId) => { await T.createInvitation(email, role as never, title, setId, ctx); await load() }} />}
    </div>
  )
}

function InviteModal({ open, sets, onClose, onSubmit }: { open: boolean; sets: PermissionSet[]; onClose: () => void; onSubmit: (email: string, role: string, title: string, setId: string | null) => Promise<void> }) {
  const [email, setEmail] = useState(''); const [title, setTitle] = useState(''); const [setId, setSetId] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setEmail(''); setTitle(''); setSetId('') } }, [open])
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!email.trim()) return; setBusy(true); try { await onSubmit(email, 'team_member', title, setId || null); onClose() } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title="Invite team member" subtitle="Email delivery is set up later — the invitation is recorded now." width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="inv" loading={busy}>Create invitation</Button></>}>
      <form id="inv" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
        <Input label="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} placeholder="Content Manager" />
        <Select label="Permission set" value={setId} onChange={e => setSetId(e.target.value)} options={[{ value: '', label: 'None' }, ...sets.map(s => ({ value: s.id, label: s.name }))]} />
      </form>
    </Modal>
  )
}

const kicker: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 11 }
function Skel() { return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 64, borderRadius: 16, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div> }
