import { useAgencyOnboarding } from '@/features/onboarding/hooks'
import { AgencyOnboardingView } from '@/features/onboarding/components/AgencyOnboardingView'
import { logAgencyViewedOnboarding } from '@/features/onboarding/api'
import { useEffect, useRef } from 'react'
import type { Client } from '@/types'

const UNLOCKED_STAGES = ['Proposal Signed', 'Onboarding', 'Client']

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
}

export function OnboardingTab({ client, ctx }: Props) {
  const stage   = client.pipeline_stages
  const unlocked = stage ? UNLOCKED_STAGES.includes(stage.name) : client.status !== 'lead'
  const loggedRef = useRef(false)

  const agencyOb = useAgencyOnboarding(client.id)

  useEffect(() => {
    if (unlocked && !loggedRef.current) {
      logAgencyViewedOnboarding(ctx.agencyId, ctx.actorId, client.id)
      loggedRef.current = true
    }
  }, [unlocked, ctx, client.id])

  if (!unlocked) {
    return (
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 22 }}>🔒</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Onboarding locked</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
          The Onboarding tab unlocks once the proposal is signed.
          Move this project to <strong>Proposal Signed</strong>, <strong>Onboarding</strong>, or <strong>Client</strong> stage to access onboarding.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
          Current stage: <strong>{stage?.name ?? client.status}</strong>
        </p>
      </div>
    )
  }

  return (
    <AgencyOnboardingView
      template={agencyOb.template}
      responses={agencyOb.responses}
      progress={agencyOb.progress}
      requiredItems={agencyOb.requiredItems}
      activity={agencyOb.activity}
      loading={agencyOb.loading}
    />
  )
}
