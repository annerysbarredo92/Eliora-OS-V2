import { KpiCard } from '@/components/ui/KpiCard'
import { Button } from '@/components/ui/Button'
import type { AgencyOnboardingProgress, AgencySetupStep, Service, Package } from '@/types'

interface OverviewTabProps {
  progress: AgencyOnboardingProgress | null
  steps: AgencySetupStep[]
  services: Service[]
  packages: Package[]
  onContinue: () => void
  onCreateService: () => void
  onCreatePackage: () => void
  onPreview: () => void
}

export function OverviewTab({ progress, steps, services, packages, onContinue, onCreateService, onCreatePackage, onPreview }: OverviewTabProps) {
  const readiness = progress?.readiness_score ?? 0
  const completion = progress?.completion_pct ?? 0
  const completed = progress?.completed_steps ?? steps.filter(s => s.status === 'completed').length
  const total = progress?.total_steps ?? steps.length
  const activeServices = services.filter(s => s.is_active).length
  const activePackages = packages.filter(p => p.is_active).length

  // Simple setup-derived health for the Overview snapshot.
  const setupHealth = completion >= 80 ? 'Strong' : completion >= 40 ? 'Building' : 'Early'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Readiness hero */}
      <div style={{ background: '#0B0913', borderRadius: 'var(--radius)', padding: '24px 26px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(109,61,230,0.3)' }}>
        <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .4, filter: 'blur(70px)', top: -120, right: -40, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Agency Readiness Score</p>
            <p style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>{readiness}%</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>{completed} of {total} setup steps complete · {completion}% complete</p>
          </div>
          <div style={{ width: 160, maxWidth: '100%' }}>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${readiness}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#F2CE5B)', borderRadius: 999, transition: 'width 400ms ease' }} />
            </div>
            <div style={{ marginTop: 14 }}>
              <Button variant="primary" size="sm" onClick={onContinue}>Continue setup →</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <KpiCard label="Readiness Score" value={`${readiness}%`} accent="violet" />
        <KpiCard label="Onboarding" value={`${completion}%`} accent="gold" hint={`${completed}/${total} steps`} />
        <KpiCard label="Active Services" value={activeServices} accent="success" />
        <KpiCard label="Active Packages" value={activePackages} accent="violet" />
        <KpiCard label="Templates" value="—" accent="muted" placeholder />
        <KpiCard label="Agency Health" value={setupHealth} accent="gold" />
      </div>

      {/* Quick actions */}
      <div>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 11 }}>Quick Actions</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" size="sm" onClick={onContinue}>Continue setup</Button>
          <Button variant="outline" size="sm" onClick={onCreateService}>Create service</Button>
          <Button variant="outline" size="sm" onClick={onCreatePackage}>Create package</Button>
          <Button variant="outline" size="sm" onClick={onPreview}>Preview workspace</Button>
        </div>
      </div>
    </div>
  )
}
