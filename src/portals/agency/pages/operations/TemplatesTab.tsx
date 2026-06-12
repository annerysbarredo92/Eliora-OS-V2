import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useOnboardingTemplate } from '@/features/onboarding/hooks'

const OTHER_TEMPLATE_TYPES = [
  { key: 'proposal', title: 'Proposal Templates', desc: 'Reusable proposals to win new clients.' },
  { key: 'invoice',  title: 'Invoice Templates',  desc: 'Branded invoices for billing.' },
  { key: 'report',   title: 'Report Templates',   desc: 'Performance report layouts.' },
  { key: 'content',  title: 'Content Templates',  desc: 'Repeatable content briefs and posts.' },
  { key: 'task',     title: 'Task Templates',     desc: 'Pre-built task checklists.' },
  { key: 'email',    title: 'Email Templates',    desc: 'Saved replies and sequences.' },
]

export function TemplatesTab({ agencyId }: { agencyId: string | null }) {
  const { template, loading } = useOnboardingTemplate(agencyId)
  const [open, setOpen] = useState(false)

  const dataSections = (template?.sections ?? []).filter(s => s.key !== 'review').sort((a, b) => a.sort_order - b.sort_order)
  const questionCount = dataSections.reduce((n, s) => n + s.questions.length, 0)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Templates standardize how you work. The Client Onboarding template is live; the rest arrive in a later phase.
      </p>

      {/* Real onboarding template */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{template?.name || 'Client Onboarding'}</h3>
                <Badge variant="success">Default</Badge>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                {loading ? 'Loading…' : `${dataSections.length} sections · ${questionCount} questions`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>{open ? 'Hide details' : 'View template'}</Button>
        </div>

        {open && template && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dataSections.map((s, i) => (
              <div key={s.id} style={{ border: '1px solid var(--hairline)', borderRadius: 14, padding: 14, background: 'var(--surface-solid)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: s.questions.length ? 8 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)' }}>{i + 1}.</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{s.title}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {s.questions.length} question{s.questions.length === 1 ? '' : 's'}</span>
                </div>
                {s.questions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.questions.map(q => (
                      <span key={q.id} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 999, background: 'var(--lavender-soft)', color: 'var(--ink-2)' }}>
                        {q.label}{q.is_required ? ' *' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {s.key === 'assets' && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Required items: Logo, Brand Photos, Videos, Service Menu, Brand Guide</p>
                )}
              </div>
            ))}
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>The drag-and-drop template builder arrives in a later phase — the data model already supports it.</p>
          </div>
        )}
      </div>

      {/* Placeholder template types */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {OTHER_TEMPLATE_TYPES.map(t => (
          <div key={t.key} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, right: 14 }}><Badge variant="default">Soon</Badge></div>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{t.title}</p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
