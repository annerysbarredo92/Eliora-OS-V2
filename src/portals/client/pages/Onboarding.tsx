import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClientOnboarding } from '@/features/onboarding/hooks'
import { saveSection, setRequiredItem, submitOnboarding } from '@/features/onboarding/api'
import { QuestionField, answerText } from '@/features/onboarding/components/QuestionField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { OnboardingSection, OnboardingRequiredItem } from '@/types'

export function ClientOnboarding() {
  const { profile: user } = useAuth()
  const ob = useClientOnboarding(user)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  // seed local answers from saved responses
  useEffect(() => { setAnswers(ob.responses) }, [ob.responses])

  const ctx = user?.agency_id && user?.client_id && user?.id && ob.template
    ? { agencyId: user.agency_id, clientId: user.client_id, actorId: user.id, templateId: ob.template.id }
    : null

  const sections = useMemo(
    () => (ob.template?.sections ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [ob.template],
  )
  const current = sections[step]
  const completion = ob.progress?.completion_pct ?? 0
  const submitted = ob.progress?.status === 'submitted'

  if (ob.loading) {
    return <div className="animate-fade-up"><div style={{ height: 440, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>
  }
  if (!ob.template || sections.length === 0) {
    return (
      <div className="animate-fade-up" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Onboarding isn't ready yet</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Your agency is still setting up your onboarding. Please check back shortly.</p>
      </div>
    )
  }

  // ── Submitted success screen ──────────────────────────────
  if (submitted && !reviewing) {
    return (
      <div className="animate-fade-up" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '32px 0' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 8 }}>Onboarding submitted</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
          Thank you — your team has everything they need to get started. You can still review or update your answers anytime.
        </p>
        {ob.progress && ob.progress.missing_items.length > 0 && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(224,162,58,0.25)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>Still outstanding ({ob.progress.missing_items.length})</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{ob.progress.missing_items.map(m => m.label).join(' · ')}</p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => { setReviewing(true); setStep(0) }}>Review answers</Button>
          <Link to="/portal/dashboard"><Button variant="primary" size="sm">Back to dashboard</Button></Link>
        </div>
      </div>
    )
  }

  function setAnswer(qid: string, v: unknown) { setAnswers(a => ({ ...a, [qid]: v })) }

  async function handleSaveContinue() {
    if (!ctx || !ob.template) return
    setBusy(true)
    try {
      const sectionAnswers: Record<string, unknown> = {}
      for (const q of current.questions) sectionAnswers[q.id] = answers[q.id] ?? null
      await saveSection(current, sectionAnswers, ob.template, ob.progress, ob.requiredItems, ctx)
      await ob.refresh()
      if (step < sections.length - 1) setStep(step + 1)
    } finally { setBusy(false) }
  }

  async function toggleItem(item: OnboardingRequiredItem, provided: boolean) {
    if (!ctx || !ob.template) return
    await setRequiredItem(item, provided, ob.template, ob.progress, ob.requiredItems, ctx)
    await ob.refresh()
  }

  async function handleSubmit() {
    if (!ctx || !ob.template) return
    setBusy(true)
    try {
      await submitOnboarding(ob.template, ob.progress, ob.requiredItems, ctx)
      await ob.refresh()
      setReviewing(false)
    } finally { setBusy(false) }
  }

  const isReview = current.key === 'review'
  const isAssets = current.key === 'assets'

  return (
    <div className="animate-fade-up">
      {/* Header + progress */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Welcome — let's get you set up</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A few quick steps so your team can do their best work. Progress saves automatically.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 999, transition: 'width 400ms ease' }} />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--violet)', flexShrink: 0 }}>{completion}%</span>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 18, paddingBottom: 4 }}>
        {sections.map((s, i) => {
          const done = ob.progress?.sections?.[s.key]
          const active = i === step
          return (
            <button key={s.id} onClick={() => setStep(i)}
              style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'all 140ms ease',
                border: `1px solid ${active ? 'var(--violet)' : 'var(--hairline)'}`,
                background: active ? 'var(--violet)' : done ? 'var(--success-bg)' : 'var(--surface-solid)',
                color: active ? '#fff' : done ? 'var(--success)' : 'var(--ink-2)',
              }}>
              {done && !active ? '✓ ' : ''}{s.title}
            </button>
          )
        })}
      </div>

      {/* Section card */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{current.title}</h2>
          {current.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{current.description}</p>}
        </div>

        {isReview ? (
          <ReviewStep sections={sections} answers={ob.responses} requiredItems={ob.requiredItems} missing={ob.progress?.missing_items ?? []} />
        ) : isAssets ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>Mark what you can share now. File uploads arrive in a later phase — for now this just tracks what's outstanding.</p>
            {ob.requiredItems.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid var(--hairline)', borderRadius: 12, cursor: 'pointer' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: item.is_provided ? 'var(--success)' : 'var(--muted)', fontWeight: 600 }}>{item.is_provided ? 'Provided' : 'Outstanding'}</span>
                  <button type="button" role="switch" aria-checked={item.is_provided} onClick={() => toggleItem(item, !item.is_provided)}
                    style={{ width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: item.is_provided ? 'var(--success)' : 'var(--hairline)', position: 'relative', transition: 'background 160ms ease' }}>
                    <span style={{ position: 'absolute', top: 3, left: item.is_provided ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 160ms ease' }} />
                  </button>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {current.questions.map(q => (
              <QuestionField key={q.id} question={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
            ))}
          </div>
        )}

        {/* Footer nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--hairline-2)' }}>
          <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</Button>
          {isReview ? (
            <Button variant="primary" onClick={handleSubmit} loading={busy}>Submit onboarding</Button>
          ) : (
            <Button variant="primary" onClick={handleSaveContinue} loading={busy}>
              {isAssets ? 'Save & continue' : 'Save & continue'} →
            </Button>
          )}
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 14 }}>
        <Link to="/portal/dashboard" style={{ fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none' }}>Save and finish later →</Link>
      </p>
    </div>
  )
}

function ReviewStep({ sections, answers, requiredItems, missing }: {
  sections: OnboardingSection[]
  answers: Record<string, unknown>
  requiredItems: OnboardingRequiredItem[]
  missing: { section: string; label: string }[]
}) {
  const dataSections = sections.filter(s => s.key !== 'review')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {missing.length > 0 && (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(224,162,58,0.25)', borderRadius: 14, padding: '12px 16px' }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warning)', marginBottom: 6 }}>Missing items ({missing.length})</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {missing.map((m, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>• {m.label} <span style={{ color: 'var(--muted)' }}>({m.section})</span></li>)}
          </ul>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>You can still submit — your team will follow up on anything outstanding.</p>
        </div>
      )}
      {dataSections.map(s => (
        <div key={s.id}>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 8 }}>{s.title}</p>
          {s.key === 'assets' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {requiredItems.map(it => (
                <Badge key={it.id} variant={it.is_provided ? 'success' : 'default'}>{it.label}{it.is_provided ? ' ✓' : ''}</Badge>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {s.questions.map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--hairline-2)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{q.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{answerText(answers[q.id])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
