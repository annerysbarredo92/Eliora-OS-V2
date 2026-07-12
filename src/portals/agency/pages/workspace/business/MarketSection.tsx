import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ChipList } from '@/components/ui/ChipList'
import { DrawerPanel, DrawerFooter } from '@/components/ui/DrawerPanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  createCompetitor, updateCompetitor, deleteCompetitor,
  readSWOT, saveSWOT, readMarketPosition, saveMarketPosition,
  type CompetitorFormValues,
} from '@/features/market/api'
import { generate } from '@/features/ai/api'
import { useCompetitors } from '@/features/market/hooks'
import type { Client, ClientCompetitor, MarketSWOT, MarketPosition } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

type ActiveTab = 'competitors' | 'swot' | 'position'

const EMPTY_COMPETITOR: CompetitorFormValues = {
  name: '', website: '', description: '', social_profiles: {},
  strengths: [], weaknesses: [], notes: '',
}

const SWOT_QUADRANTS: { key: keyof MarketSWOT; label: string; color: string; bg: string }[] = [
  { key: 'strengths',     label: 'Strengths',     color: '#059669', bg: '#ecfdf5' },
  { key: 'weaknesses',    label: 'Weaknesses',    color: '#dc2626', bg: '#fef2f2' },
  { key: 'opportunities', label: 'Opportunities', color: '#2563eb', bg: '#eff6ff' },
  { key: 'threats',       label: 'Threats',       color: '#d97706', bg: '#fffbeb' },
]

export function MarketSection({ client, ctx, onChanged }: Props) {
  const dd = (client.discovery_data ?? {}) as Record<string, unknown>

  const [activeTab, setActiveTab] = useState<ActiveTab>('competitors')

  /* ── Competitors ─────────────────────────────────────── */
  const { competitors, loading: compLoading, error: compError, refresh: refreshComp } = useCompetitors(client.id)

  const [compDrawer, setCompDrawer]       = useState(false)
  const [editingComp, setEditingComp]     = useState<ClientCompetitor | null>(null)
  const [compForm, setCompForm]           = useState<CompetitorFormValues>(EMPTY_COMPETITOR)
  const [compError2, setCompError2]       = useState<string | null>(null)
  const [compSaving, setCompSaving]       = useState(false)
  const [deletingComp, setDeletingComp]   = useState<ClientCompetitor | null>(null)
  const [compDeleting, setCompDeleting]   = useState(false)

  function openAddComp() { setEditingComp(null); setCompForm({ ...EMPTY_COMPETITOR }); setCompError2(null); setCompDrawer(true) }
  function openEditComp(c: ClientCompetitor) {
    setEditingComp(c)
    setCompForm({ name: c.name, website: c.website ?? '', description: c.description ?? '', social_profiles: c.social_profiles, strengths: c.strengths, weaknesses: c.weaknesses, notes: c.notes ?? '' })
    setCompError2(null); setCompDrawer(true)
  }

  async function saveComp() {
    if (!compForm.name.trim()) { setCompError2('Name is required'); return }
    setCompSaving(true); setCompError2(null)
    try {
      if (editingComp) await updateCompetitor(editingComp.id, client.id, compForm, ctx)
      else await createCompetitor(client.id, compForm, ctx)
      setCompDrawer(false); refreshComp(); onChanged()
    } catch (e) { setCompError2(e instanceof Error ? e.message : 'Failed to save') }
    finally { setCompSaving(false) }
  }

  const [compDeleteError, setCompDeleteError] = useState<string | null>(null)

  async function confirmDeleteComp() {
    if (!deletingComp) return
    setCompDeleting(true); setCompDeleteError(null)
    try { await deleteCompetitor(deletingComp.id, client.id, ctx); setDeletingComp(null); refreshComp(); onChanged() }
    catch (e) { setCompDeleteError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setCompDeleting(false) }
  }

  /* ── SWOT ────────────────────────────────────────────── */
  const savedSWOT = readSWOT(dd)
  const [swotForm, setSwotForm]     = useState<MarketSWOT>(savedSWOT)
  const [editingSWOT, setEditingSWOT] = useState(false)
  const [swotSaving, setSwotSaving] = useState(false)
  const [swotError, setSwotError]   = useState<string | null>(null)
  const [swotDraft, setSwotDraft]   = useState<MarketSWOT | null>(null)
  const [aiGenSWOT, setAiGenSWOT]   = useState(false)
  const [aiSwotError, setAiSwotError] = useState<string | null>(null)

  async function generateSWOT() {
    setAiGenSWOT(true); setAiSwotError(null)
    try {
      const brief = {
        business_name: client.business_name,
        industry: client.industry ?? '',
        company_description: client.company_description ?? '',
        known_competitors: competitors.map(c => c.name).join(', '),
        notes: 'Generate a SWOT analysis with an array of items for each quadrant: strengths, weaknesses, opportunities, threats. Return as JSON with key "swot" containing those four arrays.',
      }
      const outcome = await generate(brief, 1, 'swot_analysis', ctx)
      if (outcome.error) { setAiSwotError(outcome.error); return }
      const raw = outcome.result as unknown as Record<string, unknown>
      const swotRaw = raw.swot as MarketSWOT | undefined
      if (swotRaw) { setSwotDraft(swotRaw) }
      else {
        const fallback = (outcome.result.captions?.[0] ?? (raw.content as string | undefined) ?? '')
        if (fallback) {
          setSwotDraft({ strengths: [fallback], weaknesses: [], opportunities: [], threats: [] })
        }
      }
    } catch (e) { setAiSwotError(e instanceof Error ? e.message : 'AI generation failed') }
    finally { setAiGenSWOT(false) }
  }

  async function applySWOTDraft() {
    if (!swotDraft) return
    setSwotSaving(true); setSwotError(null)
    try {
      await saveSWOT(client.id, swotDraft, ctx)
      setSwotDraft(null); onChanged()
    } catch (e) { setSwotError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSwotSaving(false) }
  }

  async function saveSWOTEdit() {
    setSwotSaving(true); setSwotError(null)
    try {
      await saveSWOT(client.id, swotForm, ctx)
      setEditingSWOT(false); onChanged()
    } catch (e) { setSwotError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSwotSaving(false) }
  }

  /* ── Market Position ─────────────────────────────────── */
  const savedPosition = readMarketPosition(dd)
  const [posForm, setPosForm]       = useState<MarketPosition>(savedPosition)
  const [editingPos, setEditingPos] = useState(false)
  const [posSaving, setPosSaving]   = useState(false)
  const [posError, setPosError]     = useState<string | null>(null)

  async function savePosition() {
    setPosSaving(true); setPosError(null)
    try {
      await saveMarketPosition(client.id, posForm, ctx)
      setEditingPos(false); onChanged()
    } catch (e) { setPosError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setPosSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--hairline)' }}>
        {(['competitors', 'swot', 'position'] as ActiveTab[]).map(tab => {
          const labels: Record<ActiveTab, string> = { competitors: `Competitors (${competitors.length})`, swot: 'SWOT', position: 'Market Position' }
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? 'var(--violet)' : 'var(--ink-2)', borderBottom: activeTab === tab ? '2px solid var(--violet)' : '2px solid transparent', marginBottom: -2 }}>
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* ── Competitors tab ───────────────────────────── */}
      {activeTab === 'competitors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="sm" onClick={openAddComp}>+ Add Competitor</Button>
          </div>
          {compLoading ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
          ) : compError ? (
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>{compError}</p>
          ) : competitors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No competitors mapped yet.</p>
              <Button variant="primary" size="sm" onClick={openAddComp}>Add first competitor</Button>
            </div>
          ) : (
            competitors.map(c => (
              <div key={c.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                      {c.website && (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--violet)' }}>{c.website}</a>
                      )}
                    </div>
                    {c.description && <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 8 }}>{c.description}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {c.strengths.length > 0 && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Strengths</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.strengths.map((s, i) => <span key={i} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, background: '#ecfdf5', color: '#059669' }}>{s}</span>)}
                          </div>
                        </div>
                      )}
                      {c.weaknesses.length > 0 && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Weaknesses</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.weaknesses.map((w, i) => <span key={i} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, background: '#fef2f2', color: '#dc2626' }}>{w}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                    {c.notes && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>{c.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <Button variant="ghost" size="sm" onClick={() => openEditComp(c)}>Edit</Button>
                    <button onClick={() => setDeletingComp(c)} aria-label="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', fontSize: 13 }}>×</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SWOT tab ─────────────────────────────────── */}
      {activeTab === 'swot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {!editingSWOT && <Button variant="ghost" size="sm" onClick={() => { setSwotForm(readSWOT(dd)); setEditingSWOT(true) }}>Edit</Button>}
              {!editingSWOT && <Button variant="ghost" size="sm" onClick={generateSWOT} loading={aiGenSWOT}>AI Generate</Button>}
            </div>
            {editingSWOT && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" onClick={saveSWOTEdit} loading={swotSaving}>Save</Button>
                <Button variant="ghost"   size="sm" onClick={() => setEditingSWOT(false)} disabled={swotSaving}>Cancel</Button>
              </div>
            )}
          </div>

          {aiSwotError && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{aiSwotError}</p>}
          {swotError  && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{swotError}</p>}

          {swotDraft !== null && (
            <div style={{ background: 'var(--lavender-soft)', border: '1px solid rgba(109,61,230,0.2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--violet)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Draft — Review before applying</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {SWOT_QUADRANTS.map(q => (
                  <div key={q.key} style={{ background: q.bg, borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: q.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{q.label}</p>
                    <ChipList values={swotDraft[q.key]} onChange={v => setSwotDraft(d => d ? { ...d, [q.key]: v } : d)} placeholder={`Add ${q.label.toLowerCase()}…`} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" onClick={applySWOTDraft} loading={swotSaving}>Apply SWOT</Button>
                <Button variant="ghost"   size="sm" onClick={() => setSwotDraft(null)} disabled={swotSaving}>Discard</Button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {SWOT_QUADRANTS.map(q => {
              const activeData = editingSWOT ? swotForm[q.key] : savedSWOT[q.key]
              return (
                <div key={q.key} style={{ background: q.bg, border: `1px solid ${q.color}22`, borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: q.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{q.label}</p>
                  {editingSWOT ? (
                    <ChipList
                      values={swotForm[q.key]}
                      onChange={v => setSwotForm(f => ({ ...f, [q.key]: v }))}
                      placeholder={`Add ${q.label.toLowerCase()}…`}
                    />
                  ) : activeData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeData.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ color: q.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                          <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>None added yet</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Market Position tab ───────────────────────── */}
      {activeTab === 'position' && (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Market Position</h3>
            {!editingPos ? (
              <Button variant="ghost" size="sm" onClick={() => { setPosForm(readMarketPosition(dd)); setEditingPos(true); setPosError(null) }}>Edit</Button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" onClick={savePosition} loading={posSaving}>Save</Button>
                <Button variant="ghost"   size="sm" onClick={() => setEditingPos(false)} disabled={posSaving}>Cancel</Button>
              </div>
            )}
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {posError && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{posError}</p>}
            {editingPos ? (
              <>
                <Textarea label="Positioning Statement" rows={3} value={posForm.positioning_statement} onChange={e => setPosForm(f => ({ ...f, positioning_statement: e.target.value }))} placeholder="For [target audience], [brand] is the [category] that [key benefit] because [reason to believe]…" />
                <div><PosLabel>Differentiators</PosLabel><ChipList values={posForm.differentiators} onChange={v => setPosForm(f => ({ ...f, differentiators: v }))} placeholder="What makes this client stand out?" /></div>
                <div><PosLabel>White Space Opportunities</PosLabel><ChipList values={posForm.white_space} onChange={v => setPosForm(f => ({ ...f, white_space: v }))} placeholder="Untapped market gaps…" /></div>
                <Textarea label="Industry Notes" rows={3} value={posForm.industry_notes} onChange={e => setPosForm(f => ({ ...f, industry_notes: e.target.value }))} placeholder="Industry trends, dynamics, regulatory notes…" />
              </>
            ) : (
              <>
                <PosField label="Positioning Statement" value={savedPosition.positioning_statement} />
                <PosChips label="Differentiators"           chips={savedPosition.differentiators} />
                <PosChips label="White Space Opportunities" chips={savedPosition.white_space}     />
                <PosField label="Industry Notes"            value={savedPosition.industry_notes}  />
              </>
            )}
          </div>
        </div>
      )}

      {/* Competitor drawer */}
      <DrawerPanel
        open={compDrawer}
        onClose={() => setCompDrawer(false)}
        title={editingComp ? 'Edit Competitor' : 'Add Competitor'}
        width={520}
        footer={
          <DrawerFooter
            onCancel={() => setCompDrawer(false)}
            onConfirm={saveComp}
            loading={compSaving}
            error={compError2}
            confirmLabel={editingComp ? 'Save Changes' : 'Add Competitor'}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name *" value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} placeholder="Competitor business name" />
          <Input label="Website" value={compForm.website} onChange={e => setCompForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" />
          <Textarea label="Description" rows={2} value={compForm.description} onChange={e => setCompForm(f => ({ ...f, description: e.target.value }))} placeholder="Who are they and what do they offer?" />
          <div><p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Their Strengths</p><ChipList values={compForm.strengths} onChange={v => setCompForm(f => ({ ...f, strengths: v }))} placeholder="Add strength…" /></div>
          <div><p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Their Weaknesses</p><ChipList values={compForm.weaknesses} onChange={v => setCompForm(f => ({ ...f, weaknesses: v }))} placeholder="Add weakness…" /></div>
          <Textarea label="Notes" rows={2} value={compForm.notes} onChange={e => setCompForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any other competitive intelligence…" />
        </div>
      </DrawerPanel>

      <ConfirmDialog
        open={!!deletingComp}
        title="Delete Competitor"
        description={compDeleteError ?? `Delete "${deletingComp?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={compDeleting}
        onConfirm={confirmDeleteComp}
        onCancel={() => { setDeletingComp(null); setCompDeleteError(null) }}
      />
    </div>
  )
}

/* ── Market Position helpers ─────────────────────────────── */

function PosLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</p>
}

function PosField({ label, value }: { label: string; value: string }) {
  if (!value) return <div><PosLabel>{label}</PosLabel><p style={{ fontSize: 13.5, color: 'var(--muted)', fontStyle: 'italic' }}>—</p></div>
  return <div><PosLabel>{label}</PosLabel><p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65 }}>{value}</p></div>
}

function PosChips({ label, chips }: { label: string; chips: string[] }) {
  if (!chips.length) return <div><PosLabel>{label}</PosLabel><p style={{ fontSize: 13.5, color: 'var(--muted)', fontStyle: 'italic' }}>—</p></div>
  return (
    <div>
      <PosLabel>{label}</PosLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((c, i) => <span key={i} style={{ fontSize: 12.5, padding: '3px 10px', borderRadius: 9999, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>{c}</span>)}
      </div>
    </div>
  )
}
