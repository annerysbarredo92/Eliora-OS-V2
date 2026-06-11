import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { setStepStatus, skipOnboarding } from '@/features/operations/api'
import { STEP_STATUS_BADGE, STEP_STATUS_LABEL } from '@/features/operations/helpers'
import type { AgencySetupStep, AgencyOnboardingProgress } from '@/types'

interface OnboardingTabProps {
  steps: AgencySetupStep[]
  progress: AgencyOnboardingProgress | null
  ctx: { agencyId: string; actorId: string }
  onChanged: () => Promise<void> | void
}

export function OnboardingTab({ steps, progress, ctx, onChanged }: OnboardingTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)

  const completion = progress?.completion_pct ?? 0
  const completed = progress?.completed_steps ?? 0
  const total = progress?.total_steps ?? steps.length
  const remaining = Math.max(total - completed, 0)

  async function update(step: AgencySetupStep, status: AgencySetupStep['status']) {
    setBusyId(step.id)
    try {
      await setStepStatus(step, status, ctx)
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function handleSkip() {
    setSkipping(true)
    try {
      await skipOnboarding(ctx)
      await onChanged()
    } finally {
      setSkipping(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Progress summary */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 6 }}>Setup Progress</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{completion}%</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{completed} complete · {remaining} remaining · {total} total</span>
            </div>
          </div>
          {progress?.skipped
            ? <Badge variant="warning">Onboarding skipped</Badge>
            : completion < 100 && <Button variant="ghost" size="sm" onClick={handleSkip} loading={skipping}>Skip for now</Button>}
        </div>
        <div style={{ marginTop: 14, height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 999, transition: 'width 400ms ease' }} />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => {
          const done = step.status === 'completed'
          const busy = busyId === step.id
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                fontSize: 12.5, fontWeight: 700,
                background: done ? 'var(--success)' : 'var(--lavender-soft)',
                color: done ? '#fff' : 'var(--violet)',
                border: `1px solid ${done ? 'var(--success)' : 'var(--hairline)'}`,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 3 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{step.title}</p>
                  <Badge variant={STEP_STATUS_BADGE[step.status]}>{STEP_STATUS_LABEL[step.status]}</Badge>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{step.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {done ? (
                  <Button variant="ghost" size="sm" onClick={() => update(step, 'not_started')} loading={busy}>Undo</Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => update(step, 'completed')} loading={busy}>Mark complete</Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
