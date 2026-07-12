import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { DrawerPanel, DrawerFooter } from '@/components/ui/DrawerPanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  createGoal, updateGoal, archiveGoal, restoreGoal, deleteGoal, updateGoalProgress,
  listArchivedGoals,
  createKpi, updateKpi, archiveKpi, restoreKpi, deleteKpi, updateKpiCurrentValue,
  listArchivedKpis,
  type GoalFormValues, type KpiFormValues,
} from '@/features/goals/api'
import { useGoals, useKpis } from '@/features/goals/hooks'
import { useEffect } from 'react'
import type { Client, Goal, Kpi, GoalStatus } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

const GOAL_STATUSES: { value: GoalStatus; label: string; color: string; bg: string }[] = [
  { value: 'on_track', label: 'On Track', color: '#059669', bg: '#ecfdf5' },
  { value: 'at_risk',  label: 'At Risk',  color: '#d97706', bg: '#fffbeb' },
  { value: 'achieved', label: 'Achieved', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'missed',   label: 'Missed',   color: '#dc2626', bg: '#fef2f2' },
]

const KPI_STATUSES: { value: Kpi['status']; label: string; color: string }[] = [
  { value: 'active',           label: 'Active',           color: '#059669' },
  { value: 'needs_attention',  label: 'Needs Attention',  color: '#d97706' },
  { value: 'achieved',         label: 'Achieved',         color: '#7c3aed' },
  { value: 'inactive',         label: 'Inactive',         color: 'var(--muted)' },
]

const EMPTY_GOAL: GoalFormValues = {
  title: '', description: '', target_value: 100, current_value: 0,
  due_date: '', time_period: '', status: 'on_track', owner: '', is_client_visible: false,
}

const EMPTY_KPI: KpiFormValues = {
  name: '', description: '', metric_key: '', target_value: 100, current_value: 0,
  unit: '', period: '', goal_id: '', owner: '', status: 'active', is_client_visible: false,
}

type ActiveTab = 'goals' | 'kpis'

export function GoalsSection({ client, ctx, onChanged }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('goals')

  const { goals, loading: goalsLoading, error: goalsError, refresh: refreshGoals } = useGoals(client.id)
  const { kpis,  loading: kpisLoading,  error: kpisError,  refresh: refreshKpis  } = useKpis(client.id)

  /* ── Goals CRUD ──────────────────────────────────────── */
  const [goalDrawer, setGoalDrawer]       = useState(false)
  const [editingGoal, setEditingGoal]     = useState<Goal | null>(null)
  const [goalForm, setGoalForm]           = useState<GoalFormValues>(EMPTY_GOAL)
  const [goalError, setGoalError]         = useState<string | null>(null)
  const [goalSaving, setGoalSaving]       = useState(false)
  const [deletingGoal, setDeletingGoal]   = useState<Goal | null>(null)
  const [goalDeleting, setGoalDeleting]   = useState(false)
  const [archivingGoal, setArchivingGoal] = useState<Goal | null>(null)
  const [goalArchiving, setGoalArchiving] = useState(false)
  const [editingProgress, setEditingProgress] = useState<Goal | null>(null)
  const [progressVal, setProgressVal]     = useState('')
  const [progressSaving, setProgressSaving] = useState(false)

  function openAddGoal() {
    setEditingGoal(null); setGoalForm({ ...EMPTY_GOAL }); setGoalError(null); setGoalDrawer(true)
  }
  function openEditGoal(g: Goal) {
    setEditingGoal(g)
    setGoalForm({
      title: g.title, description: g.description ?? '',
      target_value: g.target_value, current_value: g.current_value,
      due_date: g.due_date ?? '', time_period: g.time_period ?? '',
      status: g.status, owner: g.owner ?? '', is_client_visible: g.is_client_visible,
    })
    setGoalError(null); setGoalDrawer(true)
  }

  async function saveGoal() {
    if (!goalForm.title.trim()) { setGoalError('Title is required'); return }
    setGoalSaving(true); setGoalError(null)
    try {
      if (editingGoal) await updateGoal(editingGoal.id, client.id, goalForm, ctx)
      else await createGoal(client.id, goalForm, ctx)
      setGoalDrawer(false); refreshGoals(); onChanged()
    } catch (e) { setGoalError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setGoalSaving(false) }
  }

  const [goalDeleteError, setGoalDeleteError]     = useState<string | null>(null)
  const [goalArchiveError, setGoalArchiveError]   = useState<string | null>(null)
  const [progressError, setProgressError]         = useState<string | null>(null)

  async function confirmDeleteGoal() {
    if (!deletingGoal) return
    setGoalDeleting(true); setGoalDeleteError(null)
    try { await deleteGoal(deletingGoal.id, client.id, ctx); setDeletingGoal(null); refreshGoals(); onChanged() }
    catch (e) { setGoalDeleteError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setGoalDeleting(false) }
  }

  async function confirmArchiveGoal() {
    if (!archivingGoal) return
    setGoalArchiving(true); setGoalArchiveError(null)
    try { await archiveGoal(archivingGoal.id, client.id, ctx); setArchivingGoal(null); refreshGoals(); refreshArchivedGoals(); onChanged() }
    catch (e) { setGoalArchiveError(e instanceof Error ? e.message : 'Archive failed') }
    finally { setGoalArchiving(false) }
  }

  async function saveProgress(g: Goal) {
    const val = parseFloat(progressVal)
    if (isNaN(val)) return
    setProgressSaving(true); setProgressError(null)
    try { await updateGoalProgress(g.id, client.id, val, ctx); setEditingProgress(null); refreshGoals() }
    catch (e) { setProgressError(e instanceof Error ? e.message : 'Failed to update progress') }
    finally { setProgressSaving(false) }
  }

  /* ── Archived Goals ───────────────────────────────────── */
  const [showArchivedGoals, setShowArchivedGoals] = useState(false)
  const [archivedGoals, setArchivedGoals]         = useState<Goal[]>([])
  const [archivedGoalsLoading, setArchivedGoalsLoading] = useState(false)
  const [archivedGoalsError, setArchivedGoalsError]     = useState<string | null>(null)
  const [archivedGoalsTick, setArchivedGoalsTick]       = useState(0)
  function refreshArchivedGoals() { setArchivedGoalsTick(t => t + 1) }

  useEffect(() => {
    if (!showArchivedGoals) return
    let cancelled = false
    setArchivedGoalsLoading(true); setArchivedGoalsError(null)
    listArchivedGoals(client.id).then(g => { if (!cancelled) setArchivedGoals(g) }).catch(e => { if (!cancelled) setArchivedGoalsError((e as Error).message) }).finally(() => { if (!cancelled) setArchivedGoalsLoading(false) })
    return () => { cancelled = true }
  }, [client.id, showArchivedGoals, archivedGoalsTick])

  async function restoreArchivedGoal(g: Goal) {
    try { await restoreGoal(g.id, client.id, ctx); refreshArchivedGoals(); refreshGoals(); onChanged() }
    catch (e) { setArchivedGoalsError(e instanceof Error ? e.message : 'Restore failed') }
  }

  async function deleteArchivedGoal(g: Goal) {
    if (!confirm(`Permanently delete "${g.title}"? This cannot be undone.`)) return
    try { await deleteGoal(g.id, client.id, ctx); refreshArchivedGoals(); onChanged() }
    catch (e) { setArchivedGoalsError(e instanceof Error ? e.message : 'Delete failed') }
  }

  /* ── KPIs CRUD ───────────────────────────────────────── */
  const [kpiDrawer, setKpiDrawer]       = useState(false)
  const [editingKpi, setEditingKpi]     = useState<Kpi | null>(null)
  const [kpiForm, setKpiForm]           = useState<KpiFormValues>(EMPTY_KPI)
  const [kpiError, setKpiError]         = useState<string | null>(null)
  const [kpiSaving, setKpiSaving]       = useState(false)
  const [deletingKpi, setDeletingKpi]   = useState<Kpi | null>(null)
  const [kpiDeleting, setKpiDeleting]   = useState(false)

  function openAddKpi() {
    setEditingKpi(null); setKpiForm({ ...EMPTY_KPI }); setKpiError(null); setKpiDrawer(true)
  }
  function openEditKpi(k: Kpi) {
    setEditingKpi(k)
    setKpiForm({
      name: k.name, description: k.description ?? '', metric_key: k.metric_key ?? '',
      target_value: k.target_value, current_value: k.current_value,
      unit: k.unit ?? '', period: k.period ?? '', goal_id: k.goal_id ?? '',
      owner: k.owner ?? '', status: k.status, is_client_visible: k.is_client_visible,
    })
    setKpiError(null); setKpiDrawer(true)
  }

  async function saveKpi() {
    if (!kpiForm.name.trim()) { setKpiError('Name is required'); return }
    setKpiSaving(true); setKpiError(null)
    try {
      if (editingKpi) await updateKpi(editingKpi.id, client.id, kpiForm, ctx)
      else await createKpi(client.id, kpiForm, ctx)
      setKpiDrawer(false); refreshKpis(); onChanged()
    } catch (e) { setKpiError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setKpiSaving(false) }
  }

  const [kpiDeleteError, setKpiDeleteError] = useState<string | null>(null)
  const [kpiArchiveError, setKpiArchiveError] = useState<string | null>(null)

  async function confirmDeleteKpi() {
    if (!deletingKpi) return
    setKpiDeleting(true); setKpiDeleteError(null)
    try { await deleteKpi(deletingKpi.id, client.id, ctx); setDeletingKpi(null); refreshKpis(); onChanged() }
    catch (e) { setKpiDeleteError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setKpiDeleting(false) }
  }

  async function handleArchiveKpi(k: Kpi) {
    try { await archiveKpi(k.id, client.id, ctx); refreshKpis(); refreshArchivedKpis(); onChanged() }
    catch (e) { setKpiArchiveError(e instanceof Error ? e.message : 'Archive failed') }
  }

  async function inlineKpiUpdate(k: Kpi, val: number) {
    try { await updateKpiCurrentValue(k.id, client.id, val, ctx); refreshKpis() }
    catch (e) { console.error('inlineKpiUpdate:', (e as Error).message) }
  }

  /* ── Archived KPIs ───────────────────────────────────── */
  const [showArchivedKpis, setShowArchivedKpis]     = useState(false)
  const [archivedKpis, setArchivedKpis]             = useState<Kpi[]>([])
  const [archivedKpisLoading, setArchivedKpisLoading] = useState(false)
  const [archivedKpisError, setArchivedKpisError]   = useState<string | null>(null)
  const [archivedKpisTick, setArchivedKpisTick]     = useState(0)
  function refreshArchivedKpis() { setArchivedKpisTick(t => t + 1) }

  useEffect(() => {
    if (!showArchivedKpis) return
    let cancelled = false
    setArchivedKpisLoading(true); setArchivedKpisError(null)
    listArchivedKpis(client.id).then(k => { if (!cancelled) setArchivedKpis(k) }).catch(e => { if (!cancelled) setArchivedKpisError((e as Error).message) }).finally(() => { if (!cancelled) setArchivedKpisLoading(false) })
    return () => { cancelled = true }
  }, [client.id, showArchivedKpis, archivedKpisTick])

  async function restoreArchivedKpi(k: Kpi) {
    try { await restoreKpi(k.id, client.id, ctx); refreshArchivedKpis(); refreshKpis(); onChanged() }
    catch (e) { setArchivedKpisError(e instanceof Error ? e.message : 'Restore failed') }
  }

  async function deleteArchivedKpi(k: Kpi) {
    if (!confirm(`Permanently delete "${k.name}"? This cannot be undone.`)) return
    try { await deleteKpi(k.id, client.id, ctx); refreshArchivedKpis(); onChanged() }
    catch (e) { setArchivedKpisError(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--hairline)', paddingBottom: 0 }}>
        {(['goals', 'kpis'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? 'var(--violet)' : 'var(--ink-2)',
              borderBottom: activeTab === tab ? '2px solid var(--violet)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab === 'goals' ? `Goals (${goals.length})` : `KPIs (${kpis.length})`}
          </button>
        ))}
      </div>

      {/* ── Goals tab ──────────────────────────────────── */}
      {activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="sm" onClick={openAddGoal}>+ Add Goal</Button>
          </div>
          {goalsLoading ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
          ) : goalsError ? (
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>{goalsError}</p>
          ) : goals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No goals set yet.</p>
              <Button variant="primary" size="sm" onClick={openAddGoal}>Set first goal</Button>
            </div>
          ) : (
            goals.map(g => {
              const statusDef = GOAL_STATUSES.find(s => s.value === g.status)!
              const progress  = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0
              const linkedKpis = kpis.filter(k => k.goal_id === g.id)

              return (
                <div key={g.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${statusDef.color}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{g.title}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, color: statusDef.color, background: statusDef.bg, fontWeight: 600 }}>{statusDef.label}</span>
                        {g.time_period && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{g.time_period}</span>}
                      </div>
                      {g.description && <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>{g.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button variant="ghost" size="sm" onClick={() => openEditGoal(g)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => setArchivingGoal(g)} style={{ color: 'var(--muted)' }}>Archive</Button>
                      <button onClick={() => setDeletingGoal(g)} aria-label="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', fontSize: 13 }}>×</button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Progress</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {editingProgress?.id === g.id ? (
                          <>
                            <input
                              type="number"
                              value={progressVal}
                              onChange={e => setProgressVal(e.target.value)}
                              style={{ width: 64, padding: '3px 6px', fontSize: 12, border: '1px solid var(--hairline)', borderRadius: 4 }}
                              autoFocus
                            />
                            <Button variant="primary" size="sm" onClick={() => saveProgress(g)} loading={progressSaving} style={{ fontSize: 11 }}>OK</Button>
                            <Button variant="ghost"   size="sm" onClick={() => { setEditingProgress(null); setProgressError(null) }} style={{ fontSize: 11 }}>Cancel</Button>
                            {progressError && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{progressError}</span>}
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingProgress(g); setProgressVal(g.current_value.toString()) }}
                            style={{ fontSize: 12.5, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline dotted' }}
                          >
                            {g.current_value} / {g.target_value} ({progress}%)
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 9999 }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: statusDef.color, borderRadius: 9999, transition: 'width 300ms ease' }} />
                    </div>
                  </div>

                  {/* Due date + KPI links */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {g.due_date && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Due {new Date(g.due_date).toLocaleDateString()}</span>}
                    {g.owner    && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Owner: {g.owner}</span>}
                    {linkedKpis.length > 0 && <span style={{ fontSize: 12, color: 'var(--violet)' }}>{linkedKpis.length} KPI{linkedKpis.length > 1 ? 's' : ''} linked</span>}
                  </div>
                </div>
              )
            })
          )}

          {/* Archived goals toggle */}
          <div style={{ marginTop: 8, borderTop: '1px solid var(--hairline-2)', paddingTop: 12 }}>
            <button
              onClick={() => setShowArchivedGoals(v => !v)}
              style={{ fontSize: 12.5, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ transform: showArchivedGoals ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 200ms' }}>›</span>
              Archived Goals
            </button>
            {showArchivedGoals && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {archivedGoalsError && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{archivedGoalsError}</p>}
                {archivedGoalsLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
                ) : archivedGoals.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>No archived goals.</p>
                ) : (
                  archivedGoals.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', opacity: 0.8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{g.title}</p>
                        {g.archived_at && <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Archived {new Date(g.archived_at).toLocaleDateString()}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <Button variant="ghost" size="sm" onClick={() => restoreArchivedGoal(g)}>Restore</Button>
                        <button onClick={() => deleteArchivedGoal(g)} aria-label="Permanently delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12.5, fontFamily: 'var(--font-sans)' }}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KPIs tab ───────────────────────────────────── */}
      {activeTab === 'kpis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="sm" onClick={openAddKpi}>+ Add KPI</Button>
          </div>
          {kpisLoading ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
          ) : kpisError ? (
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>{kpisError}</p>
          ) : kpis.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No KPIs set yet.</p>
              <Button variant="primary" size="sm" onClick={openAddKpi}>Add first KPI</Button>
            </div>
          ) : (
            kpis.map(k => {
              const st = KPI_STATUSES.find(s => s.value === k.status)!
              const linkedGoal = goals.find(g => g.id === k.goal_id)
              const progress = k.target_value > 0 ? Math.min(100, Math.round((k.current_value / k.target_value) * 100)) : 0

              return (
                <KpiRow
                  key={k.id}
                  kpi={k}
                  statusColor={st.color}
                  statusLabel={st.label}
                  progress={progress}
                  linkedGoal={linkedGoal}
                  onEdit={() => openEditKpi(k)}
                  onDelete={() => { setKpiDeleteError(null); setDeletingKpi(k) }}
                  onArchive={() => handleArchiveKpi(k)}
                  onUpdateCurrent={(val) => inlineKpiUpdate(k, val)}
                />
              )
            })
          )}

          {kpiArchiveError && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{kpiArchiveError}</p>}

          {/* Archived KPIs toggle */}
          <div style={{ marginTop: 8, borderTop: '1px solid var(--hairline-2)', paddingTop: 12 }}>
            <button
              onClick={() => setShowArchivedKpis(v => !v)}
              style={{ fontSize: 12.5, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ transform: showArchivedKpis ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 200ms' }}>›</span>
              Archived KPIs
            </button>
            {showArchivedKpis && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {archivedKpisError && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{archivedKpisError}</p>}
                {archivedKpisLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
                ) : archivedKpis.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>No archived KPIs.</p>
                ) : (
                  archivedKpis.map(k => (
                    <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', opacity: 0.8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{k.name}</p>
                        {k.archived_at && <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Archived {new Date(k.archived_at).toLocaleDateString()}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <Button variant="ghost" size="sm" onClick={() => restoreArchivedKpi(k)}>Restore</Button>
                        <button onClick={() => deleteArchivedKpi(k)} aria-label="Permanently delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12.5, fontFamily: 'var(--font-sans)' }}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Goal drawer ──────────────────────────────────── */}
      <DrawerPanel
        open={goalDrawer}
        onClose={() => setGoalDrawer(false)}
        title={editingGoal ? 'Edit Goal' : 'Add Goal'}
        footer={
          <DrawerFooter
            onCancel={() => setGoalDrawer(false)}
            onConfirm={saveGoal}
            loading={goalSaving}
            error={goalError}
            confirmLabel={editingGoal ? 'Save Changes' : 'Add Goal'}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Title *" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Reach 10,000 followers" />
          <Textarea label="Description" rows={2} value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional context or notes…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Target Value" type="number" value={goalForm.target_value.toString()} onChange={e => setGoalForm(f => ({ ...f, target_value: parseFloat(e.target.value) || 0 }))} />
            <Input label="Current Value" type="number" value={goalForm.current_value.toString()} onChange={e => setGoalForm(f => ({ ...f, current_value: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Due Date" type="date" value={goalForm.due_date} onChange={e => setGoalForm(f => ({ ...f, due_date: e.target.value }))} />
            <Input label="Time Period" value={goalForm.time_period} onChange={e => setGoalForm(f => ({ ...f, time_period: e.target.value }))} placeholder="e.g. Q3 2026" />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Status</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GOAL_STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setGoalForm(f => ({ ...f, status: s.value }))}
                  style={{
                    padding: '5px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600,
                    border: `1.5px solid ${goalForm.status === s.value ? s.color : 'var(--hairline)'}`,
                    background: goalForm.status === s.value ? s.bg : 'var(--surface-solid)',
                    color: goalForm.status === s.value ? s.color : 'var(--ink-2)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Input label="Owner" value={goalForm.owner} onChange={e => setGoalForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name or email" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={goalForm.is_client_visible} onChange={e => setGoalForm(f => ({ ...f, is_client_visible: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Visible to client
          </label>
        </div>
      </DrawerPanel>

      {/* ── KPI drawer ───────────────────────────────────── */}
      <DrawerPanel
        open={kpiDrawer}
        onClose={() => setKpiDrawer(false)}
        title={editingKpi ? 'Edit KPI' : 'Add KPI'}
        footer={
          <DrawerFooter
            onCancel={() => setKpiDrawer(false)}
            onConfirm={saveKpi}
            loading={kpiSaving}
            error={kpiError}
            confirmLabel={editingKpi ? 'Save Changes' : 'Add KPI'}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name *" value={kpiForm.name} onChange={e => setKpiForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Instagram Engagement Rate" />
          <Textarea label="Description" rows={2} value={kpiForm.description} onChange={e => setKpiForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this KPI measure?" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Metric Key" value={kpiForm.metric_key} onChange={e => setKpiForm(f => ({ ...f, metric_key: e.target.value }))} placeholder="e.g. ig_engagement_rate" />
            <Input label="Unit" value={kpiForm.unit} onChange={e => setKpiForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. %, followers" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Target" type="number" value={kpiForm.target_value.toString()} onChange={e => setKpiForm(f => ({ ...f, target_value: parseFloat(e.target.value) || 0 }))} />
            <Input label="Current" type="number" value={kpiForm.current_value.toString()} onChange={e => setKpiForm(f => ({ ...f, current_value: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Period" value={kpiForm.period} onChange={e => setKpiForm(f => ({ ...f, period: e.target.value }))} placeholder="e.g. Monthly, Q3 2026" />
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Linked Goal</label>
              <select value={kpiForm.goal_id} onChange={e => setKpiForm(f => ({ ...f, goal_id: e.target.value }))} style={{ width: '100%', fontSize: 13, padding: '9px 10px', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-solid)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
                <option value="">None</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Status</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {KPI_STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => setKpiForm(f => ({ ...f, status: s.value }))}
                  style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: `1.5px solid ${kpiForm.status === s.value ? s.color : 'var(--hairline)'}`, background: kpiForm.status === s.value ? 'var(--bg)' : 'var(--surface-solid)', color: kpiForm.status === s.value ? s.color : 'var(--ink-2)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Input label="Owner" value={kpiForm.owner} onChange={e => setKpiForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name or email" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={kpiForm.is_client_visible} onChange={e => setKpiForm(f => ({ ...f, is_client_visible: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Visible to client
          </label>
        </div>
      </DrawerPanel>

      {/* Confirm dialogs */}
      <ConfirmDialog open={!!deletingGoal} title="Delete Goal" description={goalDeleteError ?? `Delete "${deletingGoal?.title}"? This cannot be undone.`} confirmLabel="Delete" loading={goalDeleting} onConfirm={confirmDeleteGoal} onCancel={() => { setDeletingGoal(null); setGoalDeleteError(null) }} />
      <ConfirmDialog open={!!archivingGoal} title="Archive Goal" description={goalArchiveError ?? `Archive "${archivingGoal?.title}"? It will be hidden but recoverable.`} confirmLabel="Archive" variant="primary" loading={goalArchiving} onConfirm={confirmArchiveGoal} onCancel={() => { setArchivingGoal(null); setGoalArchiveError(null) }} />
      <ConfirmDialog open={!!deletingKpi} title="Delete KPI" description={kpiDeleteError ?? `Delete "${deletingKpi?.name}"? This cannot be undone.`} confirmLabel="Delete" loading={kpiDeleting} onConfirm={confirmDeleteKpi} onCancel={() => { setDeletingKpi(null); setKpiDeleteError(null) }} />
    </div>
  )
}

/* ── KPI row component ───────────────────────────────────── */

function KpiRow({ kpi, statusColor, statusLabel, progress, linkedGoal, onEdit, onDelete, onArchive, onUpdateCurrent }: {
  kpi: Kpi; statusColor: string; statusLabel: string; progress: number
  linkedGoal?: Goal; onEdit: () => void; onDelete: () => void; onArchive: () => void
  onUpdateCurrent: (val: number) => void
}) {
  const [editingVal, setEditingVal] = useState(false)
  const [val, setVal] = useState(kpi.current_value.toString())

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{kpi.name}</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
          {kpi.unit && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{kpi.unit}</span>}
          {kpi.period && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{kpi.period}</span>}
        </div>
        {linkedGoal && (
          <p style={{ fontSize: 12, color: 'var(--violet)', marginBottom: 4 }}>↑ {linkedGoal.title}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: 'var(--bg)', borderRadius: 9999 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: statusColor, borderRadius: 9999, transition: 'width 300ms ease' }} />
          </div>
          {editingVal ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <input
                type="number"
                value={val}
                onChange={e => setVal(e.target.value)}
                style={{ width: 64, padding: '3px 6px', fontSize: 12, border: '1px solid var(--hairline)', borderRadius: 4 }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') { onUpdateCurrent(parseFloat(val) || 0); setEditingVal(false) }
                  if (e.key === 'Escape') setEditingVal(false)
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {kpi.target_value}</span>
              <button onClick={() => { onUpdateCurrent(parseFloat(val) || 0); setEditingVal(false) }} style={{ fontSize: 11, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingVal(false)} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setVal(kpi.current_value.toString()); setEditingVal(true) }}
              style={{ fontSize: 12, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline dotted', whiteSpace: 'nowrap' }}
            >
              {kpi.current_value} / {kpi.target_value} ({progress}%)
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={onArchive} style={{ color: 'var(--muted)' }}>Archive</Button>
        <button onClick={onDelete} aria-label="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', fontSize: 13 }}>×</button>
      </div>
    </div>
  )
}
