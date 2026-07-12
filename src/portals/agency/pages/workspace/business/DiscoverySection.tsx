import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { DrawerPanel, DrawerFooter } from '@/components/ui/DrawerPanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { updateDiscoveryData } from '@/features/clients/api'
import { generate } from '@/features/ai/api'
import {
  createDiscoveryNote, updateDiscoveryNote, deleteDiscoveryNote,
  type DiscoveryNoteFormValues,
} from '@/features/discovery/notes-api'
import { useDiscoveryNotes } from '@/features/discovery/hooks'
import { supabase } from '@/lib/supabase'
import { uploadFile, deleteFile, type FilesCtx } from '@/features/files/api'
import { openStoredFile, formatBytes } from '@/lib/storage'
import type { Client, DiscoveryBusiness, DiscoveryAudience, DiscoveryMarketing, DiscoveryNote, DiscoveryAISummary, ClientAsset } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

type EditingCard = 'business' | 'audience' | 'marketing' | null

/* ── Domain readers ──────────────────────────────────────── */

function readBusiness(dd: Record<string, unknown>): DiscoveryBusiness {
  const r = dd.discovery_business as Partial<DiscoveryBusiness> | undefined
  const str = (k: keyof DiscoveryBusiness) => typeof r?.[k] === 'string' ? r[k] as string : ''
  return {
    challenges: str('challenges'), priorities: str('priorities'),
    business_model: str('business_model'), revenue_model: str('revenue_model'),
    seasonality: str('seasonality'), operational_constraints: str('operational_constraints'),
    service_area: str('service_area'), customer_journey: str('customer_journey'),
  }
}

function readAudience(dd: Record<string, unknown>): DiscoveryAudience {
  const r = dd.discovery_audience as Partial<DiscoveryAudience> | undefined
  const str = (k: keyof DiscoveryAudience) => typeof r?.[k] === 'string' ? r[k] as string : ''
  return {
    primary_audience: str('primary_audience'), segments: str('segments'),
    demographics: str('demographics'), psychographics: str('psychographics'),
    pain_points: str('pain_points'), motivations: str('motivations'),
    objections: str('objections'), buying_triggers: str('buying_triggers'),
  }
}

function readMarketing(dd: Record<string, unknown>): DiscoveryMarketing {
  const r = dd.discovery_marketing as Partial<DiscoveryMarketing> | undefined
  const str = (k: keyof DiscoveryMarketing) => typeof r?.[k] === 'string' ? r[k] as string : ''
  return {
    current_channels: str('current_channels'), past_performance: str('past_performance'),
    current_campaigns: str('current_campaigns'), challenges: str('challenges'),
    content_maturity: str('content_maturity'), paid_media_history: str('paid_media_history'),
    seo_maturity: str('seo_maturity'), conversion_process: str('conversion_process'),
  }
}

function readAISummary(dd: Record<string, unknown>): DiscoveryAISummary | null {
  const r = dd.discovery_ai_summary as Partial<DiscoveryAISummary> | undefined
  if (!r?.summary) return null
  return { summary: r.summary, generated_at: r.generated_at ?? '' }
}

const NOTE_SOURCES = [
  { value: '', label: 'Select source…' },
  { value: 'call', label: 'Discovery Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'document', label: 'Document' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'other', label: 'Other' },
]

const EMPTY_NOTE: DiscoveryNoteFormValues = { title: '', body: '', source: '' }

/* ── Main component ──────────────────────────────────────── */

export function DiscoverySection({ client, ctx, onChanged }: Props) {
  const dd = (client.discovery_data ?? {}) as Record<string, unknown>

  const [editing, setEditing] = useState<EditingCard>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  /* ── Business Understanding ──────────────────────────── */
  const [bizForm, setBizForm] = useState(readBusiness(dd))

  async function saveBusiness() {
    setSaving(true); setError(null)
    try {
      await updateDiscoveryData(client.id, { discovery_business: bizForm, discovery_sources_updated_at: new Date().toISOString() }, ctx)
      onChanged(); setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  /* ── Audience Understanding ──────────────────────────── */
  const [audForm, setAudForm] = useState(readAudience(dd))

  async function saveAudience() {
    setSaving(true); setError(null)
    try {
      await updateDiscoveryData(client.id, { discovery_audience: audForm, discovery_sources_updated_at: new Date().toISOString() }, ctx)
      onChanged(); setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  /* ── Marketing Foundation ────────────────────────────── */
  const [mktForm, setMktForm] = useState(readMarketing(dd))

  async function saveMarketing() {
    setSaving(true); setError(null)
    try {
      await updateDiscoveryData(client.id, { discovery_marketing: mktForm, discovery_sources_updated_at: new Date().toISOString() }, ctx)
      onChanged(); setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  /* ── AI Summary ──────────────────────────────────────── */
  const existingSummary = readAISummary(dd)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiDraft, setAiDraft]           = useState<string | null>(null)
  const [aiError, setAiError]           = useState<string | null>(null)
  const [freshSyncErr, setFreshSyncErr] = useState<string | null>(null)

  async function stampDiscoveryFreshness() {
    await updateDiscoveryData(client.id, { discovery_sources_updated_at: new Date().toISOString() }, ctx)
    onChanged()
  }

  async function generateAISummary() {
    setAiGenerating(true); setAiError(null)
    try {
      const biz = readBusiness(dd)
      const aud = readAudience(dd)
      const mkt = readMarketing(dd)
      const brief = {
        business_name: client.business_name,
        industry: client.industry ?? '',
        company_description: client.company_description ?? '',
        challenges: biz.challenges, priorities: biz.priorities, business_model: biz.business_model,
        primary_audience: aud.primary_audience, pain_points: aud.pain_points,
        current_channels: mkt.current_channels, current_campaigns: mkt.current_campaigns,
        notes: 'Generate a concise discovery summary covering the business context, audience, and marketing landscape.',
      }
      const outcome = await generate(brief, 1, 'discovery_summary', ctx)
      if (outcome.error) { setAiError(outcome.error); return }
      const raw = outcome.result as unknown as Record<string, unknown>
      setAiDraft((raw.content as string | undefined) ?? (outcome.result as unknown as Record<string, unknown[]>).captions?.[0] as string | undefined ?? '')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI generation failed')
    } finally { setAiGenerating(false) }
  }

  async function applyAISummary() {
    if (!aiDraft) return
    setSaving(true); setError(null)
    try {
      const summary: DiscoveryAISummary = { summary: aiDraft, generated_at: new Date().toISOString() }
      await updateDiscoveryData(client.id, { discovery_ai_summary: summary }, ctx)
      setAiDraft(null)
      onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  /* ── Notes ───────────────────────────────────────────── */
  const { notes, loading: notesLoading, error: notesError, refresh: refreshNotes } = useDiscoveryNotes(client.id)
  const [noteDrawer, setNoteDrawer]   = useState(false)
  const [noteForm, setNoteForm]       = useState<DiscoveryNoteFormValues>(EMPTY_NOTE)
  const [editingNote, setEditingNote] = useState<DiscoveryNote | null>(null)
  const [deletingNote, setDeletingNote] = useState<DiscoveryNote | null>(null)
  const [noteError, setNoteError]     = useState<string | null>(null)
  const [noteSaving, setNoteSaving]   = useState(false)
  const [noteDeleting, setNoteDeleting] = useState(false)

  function openAddNote() { setNoteForm(EMPTY_NOTE); setEditingNote(null); setNoteError(null); setNoteDrawer(true) }
  function openEditNote(n: DiscoveryNote) { setNoteForm({ title: n.title, body: n.body, source: n.source ?? '' }); setEditingNote(n); setNoteError(null); setNoteDrawer(true) }

  async function saveNote() {
    if (!noteForm.title.trim()) { setNoteError('Title is required'); return }
    setNoteSaving(true); setNoteError(null)
    try {
      if (editingNote) {
        await updateDiscoveryNote(editingNote.id, client.id, noteForm, ctx)
      } else {
        await createDiscoveryNote(client.id, noteForm, ctx)
      }
      setNoteDrawer(false); refreshNotes()
      try {
        setFreshSyncErr(null)
        await stampDiscoveryFreshness()
      } catch {
        console.error('Discovery freshness stamp failed after note save')
        setFreshSyncErr('Note saved but freshness sync failed — regenerate the summary if needed.')
        onChanged()
      }
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save note')
    } finally { setNoteSaving(false) }
  }

  const [noteDeleteError, setNoteDeleteError] = useState<string | null>(null)

  async function deleteNote() {
    if (!deletingNote) return
    setNoteDeleting(true); setNoteDeleteError(null)
    try {
      await deleteDiscoveryNote(deletingNote.id, client.id, ctx)
      setDeletingNote(null); refreshNotes()
      try {
        setFreshSyncErr(null)
        await stampDiscoveryFreshness()
      } catch {
        console.error('Discovery freshness stamp failed after note delete')
        setFreshSyncErr('Note deleted but freshness sync failed — regenerate the summary if needed.')
        onChanged()
      }
    } catch (e) {
      setNoteDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally { setNoteDeleting(false) }
  }

  /* ── Discovery Documents ─────────────────────────────── */
  const filesCtx: FilesCtx = { agencyId: ctx.agencyId, clientId: client.id, actorId: ctx.actorId, role: 'agency' }
  const [discFolderId, setDiscFolderId] = useState<string | null>(null)
  const [discFiles, setDiscFiles]       = useState<ClientAsset[]>([])
  const [discLoading, setDiscLoading]   = useState(true)
  const [discError, setDiscError]       = useState<string | null>(null)
  const [discUploading, setDiscUploading] = useState(false)
  const [discUploadErr, setDiscUploadErr] = useState<string | null>(null)
  const discFileInputRef = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setDiscLoading(true); setDiscError(null)
    async function load() {
      try {
        const { data: folders } = await supabase.from('asset_folders').select('id, name').eq('client_id', client.id).order('sort_order')
        const folder = (folders ?? []).find((f: { id: string; name: string }) => f.name === 'Discovery Documents')
        if (!folder) { if (!cancelled) { setDiscFiles([]); setDiscLoading(false) }; return }
        if (!cancelled) setDiscFolderId(folder.id)
        const { data: files, error: fe } = await supabase.from('client_assets').select('*').eq('client_id', client.id).eq('folder_id', folder.id).eq('is_archived', false).order('created_at', { ascending: false })
        if (!cancelled) {
          if (fe) setDiscError(fe.message)
          else setDiscFiles((files ?? []) as ClientAsset[])
        }
      } catch (e) {
        if (!cancelled) setDiscError((e as Error).message)
      } finally {
        if (!cancelled) setDiscLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [client.id, tick])

  async function handleDiscUpload(file: File) {
    if (!discFolderId) { setDiscUploadErr('Discovery Documents folder not found. Save a discovery note first to initialize.'); return }
    setDiscUploading(true); setDiscUploadErr(null)
    try {
      await uploadFile(file, { folderId: discFolderId, isClientVisible: false }, filesCtx)
      setTick(t => t + 1)
      try {
        setFreshSyncErr(null)
        await stampDiscoveryFreshness()
      } catch {
        console.error('Discovery freshness stamp failed after document upload')
        setDiscError('Document uploaded but freshness sync failed — regenerate the summary if needed.')
        onChanged()
      }
    } catch (e) {
      setDiscUploadErr(e instanceof Error ? e.message : 'Upload failed')
    } finally { setDiscUploading(false) }
  }

  async function handleDiscDelete(asset: ClientAsset) {
    if (!confirm(`Delete "${asset.name}"?`)) return
    try {
      await deleteFile(asset, filesCtx)
      setTick(t => t + 1)
      try {
        setFreshSyncErr(null)
        await stampDiscoveryFreshness()
      } catch {
        console.error('Discovery freshness stamp failed after document delete')
        setDiscError('Document deleted but freshness sync failed — regenerate the summary if needed.')
        onChanged()
      }
    } catch (e) {
      setDiscError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  /* ── Stale indicator ─────────────────────────────────── */
  const isAISummaryStale = (() => {
    if (!existingSummary?.generated_at) return false
    const generatedAt = new Date(existingSummary.generated_at).getTime()
    const srcUpdatedAt = dd.discovery_sources_updated_at as string | undefined
    if (!srcUpdatedAt) return false
    return new Date(srcUpdatedAt).getTime() - generatedAt > 5000
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── AI Summary ──────────────────────────────────── */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>AI Discovery Summary</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAISummaryStale && (
              <span style={{ fontSize: 11.5, color: 'var(--warning)', fontWeight: 600, background: 'color-mix(in srgb, var(--warning) 12%, transparent)', padding: '2px 8px', borderRadius: 99 }}>
                Stale — data changed
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={generateAISummary} loading={aiGenerating}>
              {existingSummary ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </div>
        <div style={{ padding: '16px 18px' }}>
          {aiError && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 10 }}>{aiError}</p>}
          {freshSyncErr && <p style={{ fontSize: 12.5, color: 'var(--warning)', marginBottom: 10 }}>{freshSyncErr}</p>}
          {aiDraft !== null ? (
            <div>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--violet)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Draft — Review before applying</p>
              <Textarea rows={6} value={aiDraft} onChange={e => setAiDraft(e.target.value)} />
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" onClick={applyAISummary} loading={saving}>Apply Summary</Button>
                <Button variant="ghost" size="sm" onClick={() => setAiDraft(null)} disabled={saving}>Discard</Button>
              </div>
            </div>
          ) : existingSummary ? (
            <div>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{existingSummary.summary}</p>
              {existingSummary.generated_at && (
                <p style={{ fontSize: 11.5, color: isAISummaryStale ? 'var(--warning)' : 'var(--muted)', marginTop: 8 }}>
                  Generated {new Date(existingSummary.generated_at).toLocaleDateString()}
                  {isAISummaryStale ? ' · Source data has changed — consider regenerating.' : ''}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13.5, color: 'var(--muted)', fontStyle: 'italic' }}>
              Fill in the sections below, then click Generate to create an AI summary of this client's business.
            </p>
          )}
        </div>
      </div>

      {/* ── Business Understanding ───────────────────────── */}
      <DiscoveryCard
        title="Business Understanding"
        editing={editing === 'business'}
        onEdit={editing === null ? () => { setBizForm(readBusiness(dd)); setEditing('business'); setError(null) } : undefined}
        onSave={saveBusiness}
        onCancel={() => setEditing(null)}
        saving={saving}
        error={editing === 'business' ? error : null}
        viewContent={
          <TwoColGrid>
            <DField label="Challenges"            value={(dd.discovery_business as Record<string, unknown>)?.challenges as string} />
            <DField label="Priorities"            value={(dd.discovery_business as Record<string, unknown>)?.priorities as string} />
            <DField label="Business Model"        value={(dd.discovery_business as Record<string, unknown>)?.business_model as string} />
            <DField label="Revenue Model"         value={(dd.discovery_business as Record<string, unknown>)?.revenue_model as string} />
            <DField label="Seasonality"           value={(dd.discovery_business as Record<string, unknown>)?.seasonality as string} />
            <DField label="Service Area"          value={(dd.discovery_business as Record<string, unknown>)?.service_area as string} />
            <DField label="Operational Constraints" value={(dd.discovery_business as Record<string, unknown>)?.operational_constraints as string} />
            <DField label="Customer Journey"      value={(dd.discovery_business as Record<string, unknown>)?.customer_journey as string} />
          </TwoColGrid>
        }
        editContent={
          <TwoColGrid>
            <Textarea label="Challenges"    rows={3} value={bizForm.challenges}              onChange={e => setBizForm(f => ({ ...f, challenges:              e.target.value }))} placeholder="What business challenges is the client facing?" />
            <Textarea label="Priorities"    rows={3} value={bizForm.priorities}              onChange={e => setBizForm(f => ({ ...f, priorities:              e.target.value }))} placeholder="What are the top priorities right now?" />
            <Textarea label="Business Model" rows={2} value={bizForm.business_model}         onChange={e => setBizForm(f => ({ ...f, business_model:          e.target.value }))} placeholder="B2B, B2C, SaaS, service-based…" />
            <Textarea label="Revenue Model"  rows={2} value={bizForm.revenue_model}          onChange={e => setBizForm(f => ({ ...f, revenue_model:           e.target.value }))} placeholder="Retainer, project, one-time, subscription…" />
            <Textarea label="Seasonality"    rows={2} value={bizForm.seasonality}            onChange={e => setBizForm(f => ({ ...f, seasonality:             e.target.value }))} placeholder="Peak seasons, slow periods…" />
            <Textarea label="Service Area"   rows={2} value={bizForm.service_area}           onChange={e => setBizForm(f => ({ ...f, service_area:            e.target.value }))} placeholder="Local, regional, national, global…" />
            <Textarea label="Operational Constraints" rows={2} value={bizForm.operational_constraints} onChange={e => setBizForm(f => ({ ...f, operational_constraints: e.target.value }))} placeholder="Team size, approval processes, tech stack…" />
            <Textarea label="Customer Journey"  rows={2} value={bizForm.customer_journey}   onChange={e => setBizForm(f => ({ ...f, customer_journey:        e.target.value }))} placeholder="How do customers find and buy from this client?" />
          </TwoColGrid>
        }
      />

      {/* ── Audience Understanding ───────────────────────── */}
      <DiscoveryCard
        title="Audience Understanding"
        editing={editing === 'audience'}
        onEdit={editing === null ? () => { setAudForm(readAudience(dd)); setEditing('audience'); setError(null) } : undefined}
        onSave={saveAudience}
        onCancel={() => setEditing(null)}
        saving={saving}
        error={editing === 'audience' ? error : null}
        viewContent={
          <TwoColGrid>
            <DField label="Primary Audience"   value={(dd.discovery_audience as Record<string, unknown>)?.primary_audience as string} />
            <DField label="Segments"           value={(dd.discovery_audience as Record<string, unknown>)?.segments as string} />
            <DField label="Demographics"       value={(dd.discovery_audience as Record<string, unknown>)?.demographics as string} />
            <DField label="Psychographics"     value={(dd.discovery_audience as Record<string, unknown>)?.psychographics as string} />
            <DField label="Pain Points"        value={(dd.discovery_audience as Record<string, unknown>)?.pain_points as string} />
            <DField label="Motivations"        value={(dd.discovery_audience as Record<string, unknown>)?.motivations as string} />
            <DField label="Objections"         value={(dd.discovery_audience as Record<string, unknown>)?.objections as string} />
            <DField label="Buying Triggers"    value={(dd.discovery_audience as Record<string, unknown>)?.buying_triggers as string} />
          </TwoColGrid>
        }
        editContent={
          <TwoColGrid>
            <Textarea label="Primary Audience"  rows={3} value={audForm.primary_audience}  onChange={e => setAudForm(f => ({ ...f, primary_audience:  e.target.value }))} placeholder="Who is their ideal customer?" />
            <Textarea label="Segments"          rows={2} value={audForm.segments}          onChange={e => setAudForm(f => ({ ...f, segments:          e.target.value }))} placeholder="Sub-groups within their audience…" />
            <Textarea label="Demographics"      rows={2} value={audForm.demographics}      onChange={e => setAudForm(f => ({ ...f, demographics:      e.target.value }))} placeholder="Age, gender, income, location…" />
            <Textarea label="Psychographics"    rows={2} value={audForm.psychographics}    onChange={e => setAudForm(f => ({ ...f, psychographics:    e.target.value }))} placeholder="Values, interests, lifestyle…" />
            <Textarea label="Pain Points"       rows={3} value={audForm.pain_points}       onChange={e => setAudForm(f => ({ ...f, pain_points:       e.target.value }))} placeholder="What problems does the audience face?" />
            <Textarea label="Motivations"       rows={2} value={audForm.motivations}       onChange={e => setAudForm(f => ({ ...f, motivations:       e.target.value }))} placeholder="What drives their decisions?" />
            <Textarea label="Objections"        rows={2} value={audForm.objections}        onChange={e => setAudForm(f => ({ ...f, objections:        e.target.value }))} placeholder="What holds them back from buying?" />
            <Textarea label="Buying Triggers"   rows={2} value={audForm.buying_triggers}   onChange={e => setAudForm(f => ({ ...f, buying_triggers:   e.target.value }))} placeholder="What pushes them to act?" />
          </TwoColGrid>
        }
      />

      {/* ── Marketing Foundation ─────────────────────────── */}
      <DiscoveryCard
        title="Marketing Foundation"
        editing={editing === 'marketing'}
        onEdit={editing === null ? () => { setMktForm(readMarketing(dd)); setEditing('marketing'); setError(null) } : undefined}
        onSave={saveMarketing}
        onCancel={() => setEditing(null)}
        saving={saving}
        error={editing === 'marketing' ? error : null}
        viewContent={
          <TwoColGrid>
            <DField label="Current Channels"    value={(dd.discovery_marketing as Record<string, unknown>)?.current_channels as string} />
            <DField label="Past Performance"    value={(dd.discovery_marketing as Record<string, unknown>)?.past_performance as string} />
            <DField label="Current Campaigns"   value={(dd.discovery_marketing as Record<string, unknown>)?.current_campaigns as string} />
            <DField label="Marketing Challenges" value={(dd.discovery_marketing as Record<string, unknown>)?.challenges as string} />
            <DField label="Content Maturity"    value={(dd.discovery_marketing as Record<string, unknown>)?.content_maturity as string} />
            <DField label="Paid Media History"  value={(dd.discovery_marketing as Record<string, unknown>)?.paid_media_history as string} />
            <DField label="SEO Maturity"        value={(dd.discovery_marketing as Record<string, unknown>)?.seo_maturity as string} />
            <DField label="Conversion Process"  value={(dd.discovery_marketing as Record<string, unknown>)?.conversion_process as string} />
          </TwoColGrid>
        }
        editContent={
          <TwoColGrid>
            <Textarea label="Current Channels"   rows={2} value={mktForm.current_channels}   onChange={e => setMktForm(f => ({ ...f, current_channels:   e.target.value }))} placeholder="Social, email, SEO, paid…" />
            <Textarea label="Past Performance"   rows={2} value={mktForm.past_performance}   onChange={e => setMktForm(f => ({ ...f, past_performance:   e.target.value }))} placeholder="What's worked or hasn't worked?" />
            <Textarea label="Current Campaigns"  rows={2} value={mktForm.current_campaigns}  onChange={e => setMktForm(f => ({ ...f, current_campaigns:  e.target.value }))} placeholder="Active campaigns or initiatives…" />
            <Textarea label="Marketing Challenges" rows={2} value={mktForm.challenges}       onChange={e => setMktForm(f => ({ ...f, challenges:          e.target.value }))} placeholder="Gaps, barriers, resource constraints…" />
            <Textarea label="Content Maturity"   rows={2} value={mktForm.content_maturity}   onChange={e => setMktForm(f => ({ ...f, content_maturity:   e.target.value }))} placeholder="Beginner, established, mature…" />
            <Textarea label="Paid Media History" rows={2} value={mktForm.paid_media_history} onChange={e => setMktForm(f => ({ ...f, paid_media_history: e.target.value }))} placeholder="Platforms, spend, results…" />
            <Textarea label="SEO Maturity"       rows={2} value={mktForm.seo_maturity}       onChange={e => setMktForm(f => ({ ...f, seo_maturity:       e.target.value }))} placeholder="Domain authority, existing rankings…" />
            <Textarea label="Conversion Process" rows={2} value={mktForm.conversion_process} onChange={e => setMktForm(f => ({ ...f, conversion_process: e.target.value }))} placeholder="How leads become customers…" />
          </TwoColGrid>
        }
      />

      {/* ── Discovery Notes ───────────────────────────────── */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Discovery Notes <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12.5 }}>({notes.length})</span>
          </h3>
          <Button variant="primary" size="sm" onClick={openAddNote}>+ Add Note</Button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notesLoading ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
          ) : notesError ? (
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>{notesError}</p>
          ) : notes.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted)', fontStyle: 'italic' }}>
              No discovery notes yet. Add notes from calls, meetings, or documents.
            </p>
          ) : (
            notes.map(note => (
              <NoteRow
                key={note.id}
                note={note}
                onEdit={() => openEditNote(note)}
                onDelete={() => setDeletingNote(note)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Note drawer ──────────────────────────────────── */}
      <DrawerPanel
        open={noteDrawer}
        onClose={() => setNoteDrawer(false)}
        title={editingNote ? 'Edit Note' : 'Add Discovery Note'}
        footer={
          <DrawerFooter
            onCancel={() => setNoteDrawer(false)}
            onConfirm={saveNote}
            loading={noteSaving}
            error={noteError}
            confirmLabel={editingNote ? 'Save Changes' : 'Add Note'}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Title *"
            value={noteForm.title}
            onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Initial Discovery Call — June 2026"
          />
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Source</label>
            <select
              value={noteForm.source}
              onChange={e => setNoteForm(f => ({ ...f, source: e.target.value as DiscoveryNoteFormValues['source'] }))}
              style={{ width: '100%', fontSize: 13, padding: '9px 10px', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-solid)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
            >
              {NOTE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <Textarea
            label="Notes"
            rows={12}
            value={noteForm.body}
            onChange={e => setNoteForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Capture everything discussed…"
          />
        </div>
      </DrawerPanel>

      {/* ── Discovery Documents ───────────────────────────── */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Discovery Documents</h3>
          <div>
            <input
              ref={discFileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDiscUpload(f); e.target.value = '' }}
            />
            <Button variant="ghost" size="sm" onClick={() => discFileInputRef.current?.click()} loading={discUploading}>
              Upload
            </Button>
          </div>
        </div>
        <div style={{ padding: '16px 18px' }}>
          {discUploadErr && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 8 }}>{discUploadErr}</p>}
          {discError && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 8 }}>{discError}</p>}
          {discLoading ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
          ) : discFiles.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--muted)', fontStyle: 'italic' }}>
              No documents uploaded yet. Upload briefs, contracts, research, or reference files.
            </p>
          ) : (
            <div>
              {discFiles.map(asset => (
                <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline-2)' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{asset.mime_type?.startsWith('image/') ? '🖼' : '📄'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => openStoredFile(asset.storage_path)}
                      style={{ fontSize: 13, fontWeight: 500, color: 'var(--violet)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
                    >
                      {asset.name}
                    </button>
                    <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatBytes(asset.size_bytes ?? 0)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDiscDelete(asset)} style={{ color: 'var(--danger)', flexShrink: 0 }}>Delete</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirm ────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletingNote}
        title="Delete Discovery Note"
        description={noteDeleteError ? noteDeleteError : `Delete "${deletingNote?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={noteDeleting}
        onConfirm={deleteNote}
        onCancel={() => { setDeletingNote(null); setNoteDeleteError(null) }}
      />

    </div>
  )
}

/* ── Shared helpers ──────────────────────────────────────── */

function TwoColGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {children}
    </div>
  )
}

function DField({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>—</p>
    </div>
  )
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  )
}

function DiscoveryCard({
  title, editing, onEdit, onSave, onCancel, saving, error, viewContent, editContent,
}: {
  title: string; editing: boolean
  onEdit?: () => void; onSave: () => void; onCancel: () => void
  saving: boolean; error: string | null
  viewContent: React.ReactNode; editContent: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h3>
        {!editing && onEdit && <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>}
      </div>
      <div style={{ padding: '16px 18px' }}>
        {editing ? editContent : viewContent}
        {editing && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button variant="primary" size="sm" onClick={onSave} loading={saving}>Save</Button>
            <Button variant="ghost"   size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
            {error && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function NoteRow({ note, onEdit, onDelete }: { note: DiscoveryNote; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const sourceLabel = NOTE_SOURCES.find(s => s.value === note.source)?.label ?? note.source ?? ''
  const date = new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
      >
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{note.title}</p>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            {date}{sourceLabel ? ` · ${sourceLabel}` : ''}
          </p>
        </div>
        <span style={{ fontSize: 16, color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', flexShrink: 0, marginLeft: 8 }}>›</span>
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--hairline-2)' }}>
          <div style={{ height: 10 }} />
          {note.body ? (
            <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{note.body}</p>
          ) : (
            <p style={{ fontSize: 13.5, color: 'var(--muted)', fontStyle: 'italic' }}>No content</p>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--danger)' }}>Delete</Button>
          </div>
        </div>
      )}
    </div>
  )
}
