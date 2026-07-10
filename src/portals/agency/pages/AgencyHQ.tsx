import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSetup, useServices, usePackages } from '@/features/operations/hooks'
import { useClients } from '@/features/clients/hooks'
import { logWorkspacePreview } from '@/features/operations/api'
import { WorkspacePreviewModal } from '@/features/operations/components/WorkspacePreviewModal'
import { OverviewTab }       from './operations/OverviewTab'
import { OnboardingTab }     from './operations/OnboardingTab'
import { ServicesTab }       from './operations/ServicesTab'
import { PackagesTab }       from './operations/PackagesTab'
import { TemplatesTab }      from './operations/TemplatesTab'
import { HealthTab }         from './operations/HealthTab'
import { PortalSettingsTab } from './operations/PortalSettingsTab'
import { AutomationsTab }    from './operations/AutomationsTab'
import { AgencyTeam }        from './Team'
import { AgencyBilling }     from './Billing'
import { AgencySettings }    from './Settings'

const TABS = [
  { id: 'overview',      label: 'Overview'         },
  { id: 'onboarding',    label: 'Onboarding'       },
  { id: 'team',          label: 'Team'             },
  { id: 'services',      label: 'Services'         },
  { id: 'packages',      label: 'Packages'         },
  { id: 'templates',     label: 'Templates'        },
  { id: 'portal',        label: 'Client Portal'    },
  { id: 'automations',   label: 'Automations'      },
  { id: 'integrations',  label: 'Integrations', locked: true },
  { id: 'billing',       label: 'Billing'          },
  { id: 'settings',      label: 'Settings'         },
  { id: 'health',        label: 'Agency Health'    },
]

export function AgencyHQ() {
  const { tab: urlTab }    = useParams<{ tab?: string }>()
  const { profile }        = useAuth()
  const navigate           = useNavigate()

  const [previewOpen, setPreviewOpen]     = useState(false)
  const [serviceSignal, setServiceSignal] = useState(0)
  const [packageSignal, setPackageSignal] = useState(0)

  const initialTab = urlTab && TABS.some(t => t.id === urlTab && !t.locked) ? urlTab : 'overview'
  const [activeTab, setActiveTabState] = useState(initialTab)

  function setActiveTab(id: string) {
    setActiveTabState(id)
    navigate(`/agency/agency/${id}`, { replace: true })
  }

  const agencyId = profile?.agency_id ?? null
  const ctx      = profile?.agency_id && profile?.id ? { agencyId: profile.agency_id, actorId: profile.id } : null

  const setup   = useSetup(agencyId)
  const svc     = useServices()
  const pkg     = usePackages()
  const clients = useClients()

  if (!ctx) {
    return (
      <div className="animate-fade-up" style={{ padding: '40px 0' }}>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>No agency workspace found for your account.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Agency</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Run and configure your agency — team, services, billing, and more.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--hairline)', marginBottom: 22, overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => !t.locked && setActiveTab(t.id)}
              disabled={!!t.locked}
              title={t.locked ? 'Coming soon' : undefined}
              style={{
                padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
                fontWeight: active ? 600 : 400,
                color: t.locked ? 'var(--muted)' : active ? 'var(--violet)' : 'var(--ink-2)',
                background: 'none', border: 'none',
                cursor: t.locked ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                borderBottom: active ? '2px solid var(--violet)' : '2px solid transparent',
                marginBottom: -1, letterSpacing: '-0.01em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {t.label}
              {t.locked && <LockIcon />}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          progress={setup.progress}
          steps={setup.steps}
          services={svc.services}
          packages={pkg.packages}
          onContinue={() => setActiveTab('onboarding')}
          onCreateService={() => { setActiveTab('services'); setServiceSignal(n => n + 1) }}
          onCreatePackage={() => { setActiveTab('packages'); setPackageSignal(n => n + 1) }}
          onPreview={() => { if (ctx) logWorkspacePreview(ctx); setPreviewOpen(true) }}
        />
      )}
      {activeTab === 'onboarding' && (
        <OnboardingTab steps={setup.steps} progress={setup.progress} ctx={ctx} onChanged={() => setup.refresh()} />
      )}
      {activeTab === 'team'    && <AgencyTeam />}
      {activeTab === 'services' && (
        <ServicesTab services={svc.services} loading={svc.loading} ctx={ctx} onChanged={async () => { await svc.refresh(); await setup.refresh() }} openSignal={serviceSignal} />
      )}
      {activeTab === 'packages' && (
        <PackagesTab packages={pkg.packages} services={svc.services} loading={pkg.loading} ctx={ctx} onChanged={async () => { await pkg.refresh(); await setup.refresh() }} openSignal={packageSignal} />
      )}
      {activeTab === 'templates'    && <TemplatesTab agencyId={agencyId} />}
      {activeTab === 'portal'       && <PortalSettingsTab agencyId={agencyId} />}
      {activeTab === 'automations'  && <AutomationsTab ctx={ctx} />}
      {activeTab === 'billing'      && <AgencyBilling />}
      {activeTab === 'settings'     && <AgencySettings ctx={ctx} />}
      {activeTab === 'health'       && (
        <HealthTab progress={setup.progress} services={svc.services} packages={pkg.packages} clientCount={clients.metrics.total} />
      )}

      <WorkspacePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
