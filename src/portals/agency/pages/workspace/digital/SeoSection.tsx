import { useState, useEffect, useCallback } from 'react'
import * as DG from '@/features/digital/api'
import { ErrorBanner, Skel, EmptyState } from './WebsiteSection'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DrawerPanel } from '@/components/ui/DrawerPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { SeoProfile, SeoIssue, SeoCheckStatus, Website } from '@/types'

// SEO is an ASSESSMENT record, not a CRUD list — seo_profiles enforces
// exactly one row per client (seo_profiles_one_per_client). This section
// always shows either the current assessment or a "not assessed yet"
// empty state, never a list.

const CHECK_BADGE: Record<SeoCheckStatus, 'default' | 'success' | 'warning' | 'danger' | 'brand'> = {
  unknown: 'default', not_configured: 'default', issue: 'warning', healthy: 'success',
}

const BLANK_FORM: DG.SeoProfileFormValues = {
  website_id: '', indexing_status: 'unknown', sitemap_status: 'unknown', robots_status: 'unknown',
  search_console_status: 'manual', technical_health_status: 'unknown',
  keyword_baseline_count: '', visibility_baseline_score: '', issues: [],
  recommendations: '', last_checked_at: '', notes: '',
}

interface Props {
  client: { id: string }
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function SeoSection({ client, ctx, onChanged }: Props) {
  const [profile, setProfile] = useState<SeoProfile | null>(null)
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState<DG.SeoProfileFormValues>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, w] = await Promise.all([DG.getSeoProfile(client.id), DG.listWebsites(client.id)])
      setProfile(p); setWebsites(w.filter(site => site.status !== 'archived'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SEO data')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])

  function openAssessment() {
    setForm(profile ? {
      website_id: profile.website_id ?? '',
      indexing_status: profile.indexing_status, sitemap_status: profile.sitemap_status, robots_status: profile.robots_status,
      search_console_status: profile.search_console_status, technical_health_status: profile.technical_health_status,
      keyword_baseline_count: profile.keyword_baseline_count != null ? String(profile.keyword_baseline_count) : '',
      visibility_baseline_score: profile.visibility_baseline_score != null ? String(profile.visibility_baseline_score) : '',
      issues: profile.issues ?? [], recommendations: profile.recommendations ?? '',
      last_checked_at: profile.last_checked_at ? profile.last_checked_at.slice(0, 10) : '',
      notes: profile.notes ?? '',
    } : BLANK_FORM)
    setFormErr(null); setDrawerOpen(true)
  }

  async function save() {
    setSaving(true); setFormErr(null)
    try {
      const saved = await DG.saveSeoProfile(client.id, form, ctx)
      setProfile(saved); setDrawerOpen(false); onChanged()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save SEO assessment')
    } finally {
      setSaving(false)
    }
  }

  const website = websites.find(w => w.id === profile?.website_id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>SEO</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Technical search-readiness and baseline visibility — not content or keyword campaigns.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openAssessment} className="min-h-[44px]">
          {profile ? 'Update Assessment' : 'Start Assessment'}
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skel />}

      {!loading && !profile && (
        <EmptyState
          title="Not assessed yet"
          description="No technical SEO assessment has been recorded for this client. Record indexing, sitemap, robots, and Search Console status manually to establish a baseline."
          action={<Button variant="primary" size="sm" onClick={openAssessment}>Start assessment</Button>}
        />
      )}

      {!loading && profile && (
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                {website ? `Associated with ${website.name}` : 'Not associated with a specific website'}
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                {profile.last_checked_at ? `Last checked ${new Date(profile.last_checked_at).toLocaleDateString()}` : 'No last-checked date on file'}
              </p>
            </div>
            <Badge variant={CHECK_BADGE[profile.technical_health_status]}>{DG.SEO_CHECK_STATUS_LABELS[profile.technical_health_status]}</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <StatusTile label="Indexing" status={profile.indexing_status} />
            <StatusTile label="Sitemap" status={profile.sitemap_status} />
            <StatusTile label="Robots.txt" status={profile.robots_status} />
            <StatusTile label="Search Console" value={DG.INTEGRATION_STATUS_LABELS[profile.search_console_status]} />
          </div>

          {(profile.keyword_baseline_count != null || profile.visibility_baseline_score != null) && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 4 }}>
              {profile.keyword_baseline_count != null && (
                <div><p style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyword baseline</p><p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{profile.keyword_baseline_count}</p></div>
              )}
              {profile.visibility_baseline_score != null && (
                <div><p style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visibility score</p><p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{profile.visibility_baseline_score}</p></div>
              )}
            </div>
          )}

          {profile.issues.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>Known Issues</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {profile.issues.map((iss, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <Badge variant={iss.severity === 'high' ? 'danger' : iss.severity === 'medium' ? 'warning' : 'default'}>{DG.SEO_ISSUE_SEVERITY_LABELS[iss.severity]}</Badge>
                    {iss.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.recommendations && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 6 }}>Recommendations</p>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{profile.recommendations}</p>
            </div>
          )}

          {profile.notes && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 6 }}>Notes</p>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{profile.notes}</p>
            </div>
          )}
        </div>
      )}

      <DrawerPanel
        open={drawerOpen}
        title={profile ? 'Update SEO Assessment' : 'Start SEO Assessment'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>Save Assessment</Button>
          </>
        }
      >
        <SeoForm form={form} setForm={setForm} formErr={formErr} websites={websites} />
      </DrawerPanel>
    </div>
  )
}

function StatusTile({ label, status, value }: { label: string; status?: SeoCheckStatus; value?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline-2)', borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{status ? DG.SEO_CHECK_STATUS_LABELS[status] : value}</p>
    </div>
  )
}

/* ── Form ─────────────────────────────────────────────────── */

function SeoForm({ form, setForm, formErr, websites }: {
  form: DG.SeoProfileFormValues
  setForm: React.Dispatch<React.SetStateAction<DG.SeoProfileFormValues>>
  formErr: string | null
  websites: Website[]
}) {
  const [issueLabel, setIssueLabel] = useState('')
  const [issueSeverity, setIssueSeverity] = useState<SeoIssue['severity']>('medium')
  const websiteOptions = [{ value: '', label: 'Not associated with a specific website' }, ...websites.map(w => ({ value: w.id, label: w.name }))]

  function addIssue() {
    const label = issueLabel.trim()
    if (!label) return
    const code = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'issue'
    setForm(f => ({ ...f, issues: [...f.issues, { code, label, severity: issueSeverity }] }))
    setIssueLabel('')
  }
  function removeIssue(i: number) {
    setForm(f => ({ ...f, issues: f.issues.filter((_, idx) => idx !== i) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Select label="Associated website" value={form.website_id} onChange={e => setForm(f => ({ ...f, website_id: e.target.value }))} options={websiteOptions} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Indexing status" value={form.indexing_status} onChange={e => setForm(f => ({ ...f, indexing_status: e.target.value as SeoCheckStatus }))} options={DG.SEO_CHECK_STATUS_OPTIONS} />
        <Select label="Sitemap status" value={form.sitemap_status} onChange={e => setForm(f => ({ ...f, sitemap_status: e.target.value as SeoCheckStatus }))} options={DG.SEO_CHECK_STATUS_OPTIONS} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Select label="Robots.txt status" value={form.robots_status} onChange={e => setForm(f => ({ ...f, robots_status: e.target.value as SeoCheckStatus }))} options={DG.SEO_CHECK_STATUS_OPTIONS} />
        <Select label="Search Console" value={form.search_console_status} onChange={e => setForm(f => ({ ...f, search_console_status: e.target.value as DG.SeoProfileFormValues['search_console_status'] }))} options={DG.INTEGRATION_STATUS_OPTIONS} />
      </div>
      <Select label="Overall technical health" value={form.technical_health_status} onChange={e => setForm(f => ({ ...f, technical_health_status: e.target.value as SeoCheckStatus }))} options={DG.SEO_CHECK_STATUS_OPTIONS} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Keyword baseline count" value={form.keyword_baseline_count} onChange={e => setForm(f => ({ ...f, keyword_baseline_count: e.target.value }))} inputMode="numeric" placeholder="Optional" />
        <Input label="Visibility baseline score" value={form.visibility_baseline_score} onChange={e => setForm(f => ({ ...f, visibility_baseline_score: e.target.value }))} inputMode="decimal" placeholder="Optional" />
      </div>

      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Known issues</p>
        {form.issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {form.issues.map((iss, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--hairline-2)', borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink)', flex: 1 }}>{iss.label}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{DG.SEO_ISSUE_SEVERITY_LABELS[iss.severity]}</span>
                <button type="button" onClick={() => removeIssue(i)} aria-label={`Remove issue: ${iss.label}`} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, padding: 2 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input label="" value={issueLabel} onChange={e => setIssueLabel(e.target.value)} placeholder="e.g. Sitemap returns 404" />
          </div>
          <Select label="" value={issueSeverity} onChange={e => setIssueSeverity(e.target.value as SeoIssue['severity'])} options={DG.SEO_ISSUE_SEVERITY_OPTIONS} />
          <Button variant="outline" size="sm" onClick={addIssue} type="button">Add</Button>
        </div>
      </div>

      <Textarea label="Recommendations" value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} rows={2} />
      <Input label="Last checked" type="date" value={form.last_checked_at} onChange={e => setForm(f => ({ ...f, last_checked_at: e.target.value }))} />
      <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      {formErr && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{formErr}</p>}
    </div>
  )
}
