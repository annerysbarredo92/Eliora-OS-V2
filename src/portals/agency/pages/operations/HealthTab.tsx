import type { AgencyOnboardingProgress, Service, Package } from '@/types'

interface HealthTabProps {
  progress: AgencyOnboardingProgress | null
  services: Service[]
  packages: Package[]
  clientCount: number
}

function band(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'Strong', color: 'var(--success)' }
  if (pct >= 40) return { label: 'Building', color: 'var(--warning)' }
  return { label: 'Early', color: 'var(--danger)' }
}

export function HealthTab({ progress, services, packages, clientCount }: HealthTabProps) {
  const setup = progress?.completion_pct ?? 0
  const serviceHealth = services.some(s => s.is_active) ? 100 : 0
  const packageHealth = packages.some(p => p.is_active) ? 100 : 0
  const clientHealth = clientCount > 0 ? 100 : 0

  const metrics = [
    { key: 'setup',   label: 'Setup Health',         value: setup,         desc: 'Onboarding completion across all steps.' },
    { key: 'client',  label: 'Client Setup Health',  value: clientHealth,  desc: clientCount > 0 ? `${clientCount} client${clientCount === 1 ? '' : 's'} added.` : 'No clients yet.' },
    { key: 'service', label: 'Service Setup Health', value: serviceHealth, desc: serviceHealth ? 'At least one active service.' : 'No active services yet.' },
    { key: 'package', label: 'Package Setup Health', value: packageHealth, desc: packageHealth ? 'At least one active package.' : 'No active packages yet.' },
  ]

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Early setup-based health signals. Full performance scoring comes in a later phase.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {metrics.map(m => {
          const b = band(m.value)
          return (
            <div key={m.key} style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{m.label}</p>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: b.color }}>{b.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{m.value}</span>
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>%</span>
              </div>
              <div style={{ height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ width: `${m.value}%`, height: '100%', background: b.color, borderRadius: 999, transition: 'width 400ms ease' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>{m.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
