import { useState, useEffect, useCallback, useMemo } from 'react'
import * as DG from '@/features/digital/api'
import { ErrorBanner, Skel, EmptyState, ConfirmModal } from './WebsiteSection'
import { computeMetricChange, latestAndPrevious, formatDelta, formatPercent } from './socialGrowth'
import { Button } from '@/components/ui/Button'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { SocialChannel, SocialChannelSnapshot } from '@/types'

const BLANK_SNAPSHOT_FORM: DG.SnapshotFormValues = {
  snapshot_date: new Date().toISOString().slice(0, 10),
  followers: '', following: '', reach: '', impressions: '', engagements: '',
  engagement_rate: '', profile_views: '', link_clicks: '', posts_count: '',
}

const METRICS: { key: keyof DG.SnapshotFormValues; label: string; kind: 'int' | 'decimal'; suffix?: string }[] = [
  { key: 'followers', label: 'Followers', kind: 'int' },
  { key: 'following', label: 'Following', kind: 'int' },
  { key: 'reach', label: 'Reach', kind: 'int' },
  { key: 'impressions', label: 'Impressions', kind: 'int' },
  { key: 'engagements', label: 'Engagements', kind: 'int' },
  { key: 'engagement_rate', label: 'Engagement rate', kind: 'decimal', suffix: '%' },
  { key: 'profile_views', label: 'Profile views', kind: 'int' },
  { key: 'link_clicks', label: 'Link clicks', kind: 'int' },
  { key: 'posts_count', label: 'Posts count', kind: 'int' },
]

// Shown as its own tile with "%" formatting rather than in the same
// raw-count grid as followers/reach/etc, and excluded from the plain
// delta/percent-of-itself comparison math those use (a rate's own
// point-change, e.g. "+0.8", reads better than treating it as another
// count with a misleading "% growth of a percentage").
const COUNT_METRICS = METRICS.filter(m => m.key !== 'engagement_rate')

const RANGE_OPTIONS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
  { value: 'all', label: 'All history' },
]

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onGoToChannels: () => void
  /** Pre-selects a channel when arriving via "View Tracker" on a channel card. */
  initialChannelId?: string
}

type ChannelsLoadState = 'loading' | 'ready' | 'error'

export function SocialTrackerSection({ client, ctx, onChanged, onGoToChannels, initialChannelId }: Props) {
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [channelsState, setChannelsState] = useState<ChannelsLoadState>('loading')
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<string>(initialChannelId ?? '')

  const loadChannels = useCallback(async () => {
    setChannelsState('loading'); setChannelsError(null)
    try {
      const list = await DG.listSocialChannels(client.id)
      setChannels(list)
      setChannelsState('ready')
      setSelectedChannelId(prev => {
        if (prev && list.some(c => c.id === prev)) return prev
        return list.find(c => c.is_active)?.id ?? list[0]?.id ?? ''
      })
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : 'Failed to load social channels')
      setChannelsState('error')
    }
  }, [client.id])

  useEffect(() => { loadChannels() }, [loadChannels])

  if (channelsState === 'loading') return <Skel />

  if (channelsState === 'error') {
    return <ErrorBanner message={channelsError ?? 'Could not load social channels'} />
  }

  if (channels.length === 0) {
    return (
      <div>
        <SectionHeader />
        <EmptyState
          title="No social channels added yet"
          description="Social Tracker records metrics for channels already set up in Social Channels — add a channel there first."
          action={<Button variant="primary" size="sm" onClick={onGoToChannels}>Go to Social Channels</Button>}
        />
      </div>
    )
  }

  const selectedChannel = channels.find(c => c.id === selectedChannelId) ?? channels[0]

  return (
    <div>
      <SectionHeader />
      <div style={{ marginBottom: 18, maxWidth: 360 }}>
        <Select
          label="Channel"
          value={selectedChannel.id}
          onChange={e => setSelectedChannelId(e.target.value)}
          options={channels.map(c => ({
            value: c.id,
            label: `${c.platform === 'other' ? (c.platform_other_label ?? 'Other') : DG.SOCIAL_PLATFORM_LABELS[c.platform]}${c.handle ? ` — ${c.handle}` : ''}${!c.is_active ? ' (inactive)' : ''}`,
          }))}
        />
      </div>
      <ChannelTracker key={selectedChannel.id} channel={selectedChannel} ctx={ctx} onChanged={onChanged} />
    </div>
  )
}

function SectionHeader() {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Social Tracker</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>Historical account-level metrics — not a post analytics dashboard.</p>
    </div>
  )
}

/* ── Per-channel tracker ──────────────────────────────────── */

function ChannelTracker({ channel, ctx, onChanged }: {
  channel: SocialChannel
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}) {
  const [snapshots, setSnapshots] = useState<SocialChannelSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('90')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSnapshot, setEditingSnapshot] = useState<SocialChannelSnapshot | null>(null)
  const [form, setForm] = useState<DG.SnapshotFormValues>(BLANK_SNAPSHOT_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SocialChannelSnapshot | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setSnapshots(await DG.listSnapshotsByChannel(channel.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load metrics history') }
    finally { setLoading(false) }
  }, [channel.id])

  useEffect(() => { load() }, [load])

  // "Latest vs previous" always compares the true two most recent snapshots,
  // independent of the history-table time range below — a 30-day view
  // should not make a real prior snapshot outside that window disappear
  // from the comparison, only from the table.
  const [latest, previous] = useMemo(() => latestAndPrevious(snapshots), [snapshots])

  const visibleSnapshots = useMemo(() => {
    if (range === 'all') return snapshots
    const days = Number(range)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return snapshots.filter(s => new Date(s.snapshot_date + 'T00:00:00Z').getTime() >= cutoff)
  }, [snapshots, range])

  function openRecord() {
    setEditingSnapshot(null); setForm(BLANK_SNAPSHOT_FORM); setFormErr(null); setDrawerOpen(true)
  }

  function openEditSnapshot(s: SocialChannelSnapshot) {
    setEditingSnapshot(s)
    setForm({
      snapshot_date: s.snapshot_date,
      followers: s.followers?.toString() ?? '', following: s.following?.toString() ?? '',
      reach: s.reach?.toString() ?? '', impressions: s.impressions?.toString() ?? '',
      engagements: s.engagements?.toString() ?? '', engagement_rate: s.engagement_rate?.toString() ?? '',
      profile_views: s.profile_views?.toString() ?? '', link_clicks: s.link_clicks?.toString() ?? '',
      posts_count: s.posts_count?.toString() ?? '',
    })
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    setSaving(true); setFormErr(null)
    try {
      await DG.upsertSocialChannelSnapshot(channel, form, ctx)
      setDrawerOpen(false); await load(); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save metrics')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: SocialChannelSnapshot) {
    setDeletingId(s.id)
    try { await DG.deleteSocialChannelSnapshot(s.id); setConfirmDelete(null); await load(); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete snapshot') }
    finally { setDeletingId(null) }
  }

  if (loading) return <Skel />
  if (error) return <ErrorBanner message={error} />

  if (snapshots.length === 0) {
    return (
      <>
        <EmptyState
          title="Channels are set up, but no metrics have been recorded yet"
          description="Record this channel's first snapshot to start tracking growth over time."
          action={<Button variant="primary" size="sm" onClick={openRecord}>Record metrics</Button>}
        />
        <RecordDrawer open={drawerOpen} editing={editingSnapshot} form={form} setForm={setForm} formErr={formErr} saving={saving} onClose={() => setDrawerOpen(false)} onSave={save} />
      </>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Latest snapshot: {new Date(latest!.snapshot_date + 'T00:00:00Z').toLocaleDateString()}</p>
        <Button variant="primary" size="sm" onClick={openRecord} className="min-h-[44px]">Record metrics</Button>
      </div>

      {/* ── Latest + comparison ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {COUNT_METRICS.map(m => {
          const current = latest ? (latest[m.key as keyof SocialChannelSnapshot] as number | null) : null
          const prev = previous ? (previous[m.key as keyof SocialChannelSnapshot] as number | null) : null
          const change = computeMetricChange(current, prev)
          return <MetricTile key={m.key} label={m.label} change={change} hasPrevious={previous !== null} />
        })}
        {/* Engagement rate: its own tile, point-change rather than
            percent-of-a-percent (see COUNT_METRICS comment above). */}
        <EngagementRateTile
          current={latest?.engagement_rate ?? null}
          previous={previous?.engagement_rate ?? null}
          hasPrevious={previous !== null}
        />
      </div>

      {/* ── History ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>History</p>
        <div style={{ width: 180 }}>
          <Select value={range} onChange={e => setRange(e.target.value)} options={RANGE_OPTIONS} />
        </div>
      </div>

      {visibleSnapshots.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>No snapshots in this range.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-solid)', textAlign: 'left' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Followers</th>
                <th style={thStyle}>Reach</th>
                <th style={thStyle}>Impressions</th>
                <th style={thStyle}>Engagements</th>
                <th style={thStyle}>Profile views</th>
                <th style={thStyle}>Clicks</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {visibleSnapshots.map(s => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--hairline-2)' }}>
                  <td style={tdStyle}>{new Date(s.snapshot_date + 'T00:00:00Z').toLocaleDateString()}</td>
                  <td style={tdStyle}>{formatMetric(s.followers)}</td>
                  <td style={tdStyle}>{formatMetric(s.reach)}</td>
                  <td style={tdStyle}>{formatMetric(s.impressions)}</td>
                  <td style={tdStyle}>{formatMetric(s.engagements)}</td>
                  <td style={tdStyle}>{formatMetric(s.profile_views)}</td>
                  <td style={tdStyle}>{formatMetric(s.link_clicks)}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEditSnapshot(s)} style={linkBtnStyle}>Edit</button>
                    {' · '}
                    <button onClick={() => setConfirmDelete(s)} style={{ ...linkBtnStyle, color: 'var(--danger)' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordDrawer open={drawerOpen} editing={editingSnapshot} form={form} setForm={setForm} formErr={formErr} saving={saving} onClose={() => setDrawerOpen(false)} onSave={save} />

      {confirmDelete && (
        <ConfirmModal
          title="Delete this snapshot?"
          body={`The snapshot for ${new Date(confirmDelete.snapshot_date + 'T00:00:00Z').toLocaleDateString()} will be permanently removed.`}
          confirmLabel="Delete"
          danger
          loading={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </div>
  )
}

/* ── Metric tile ──────────────────────────────────────────── */

function MetricTile({ label, change, hasPrevious }: {
  label: string
  change: ReturnType<typeof computeMetricChange>
  hasPrevious: boolean
}) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        {change.current === null ? '—' : change.current.toLocaleString()}
      </p>
      {!hasPrevious ? (
        <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>No comparison yet</p>
      ) : !change.comparable ? (
        <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>No comparison</p>
      ) : (
        <p style={{ fontSize: 11.5, color: (change.delta ?? 0) > 0 ? 'var(--success)' : (change.delta ?? 0) < 0 ? 'var(--danger)' : 'var(--muted)' }}>
          {formatDelta(change.delta)} · {formatPercent(change.percent)}
        </p>
      )}
    </div>
  )
}

function EngagementRateTile({ current, previous, hasPrevious }: {
  current: number | null
  previous: number | null
  hasPrevious: boolean
}) {
  const delta = current !== null && previous !== null ? current - previous : null
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Engagement rate</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        {current === null ? '—' : `${current}%`}
      </p>
      {!hasPrevious ? (
        <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>No comparison yet</p>
      ) : delta === null ? (
        <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>No comparison</p>
      ) : (
        <p style={{ fontSize: 11.5, color: delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--muted)' }}>
          {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} pts
        </p>
      )}
    </div>
  )
}

/* ── Record/edit drawer ───────────────────────────────────── */

function RecordDrawer({ open, editing, form, setForm, formErr, saving, onClose, onSave }: {
  open: boolean
  editing: SocialChannelSnapshot | null
  form: DG.SnapshotFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.SnapshotFormValues>>
  formErr: string | null
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  return (
    <DrawerPanel
      open={open}
      title={editing ? 'Edit Metrics' : 'Record Metrics'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={onSave}>Save</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Snapshot date *" type="date" value={form.snapshot_date} onChange={e => setForm(f => ({ ...f, snapshot_date: e.target.value }))} hint="Recording metrics again for an existing date corrects that day's snapshot instead of creating a duplicate." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {METRICS.map(m => (
            <Input
              key={m.key}
              label={m.label}
              value={form[m.key]}
              onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))}
              inputMode={m.kind === 'int' ? 'numeric' : 'decimal'}
              placeholder="Leave blank if unrecorded"
            />
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Leave a field blank if it wasn't recorded — a blank field is treated as unknown, not zero.</p>
        {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
      </div>
    </DrawerPanel>
  )
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatMetric(value: number | null): string {
  return value === null ? '—' : value.toLocaleString()
}

const thStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }
const tdStyle: React.CSSProperties = { padding: '9px 12px', color: 'var(--ink-2)' }
const linkBtnStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--violet)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
