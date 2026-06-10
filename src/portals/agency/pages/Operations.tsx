import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const TABS = [
  { id: 'onboarding',    label: 'Agency Onboarding' },
  { id: 'services',      label: 'Services' },
  { id: 'packages',      label: 'Packages' },
  { id: 'templates',     label: 'Templates' },
  { id: 'team',          label: 'Team Management' },
  { id: 'automations',   label: 'Automations' },
  { id: 'health',        label: 'Agency Health' },
  { id: 'workspace',     label: 'Workspace Config' },
]

const ONBOARDING_STEPS = [
  { id: 1, title: 'Agency Profile',       desc: 'Set up your agency name, logo, and branding.',        done: true },
  { id: 2, title: 'Add Your First Client', desc: 'Create a client profile and send a portal invite.',   done: false },
  { id: 3, title: 'Define Your Services',  desc: 'Add the services and packages you offer.',            done: false },
  { id: 4, title: 'Invite Your Team',      desc: 'Add team members and assign roles.',                  done: false },
  { id: 5, title: 'Customize Templates',   desc: 'Set up contract, proposal, and report templates.',    done: false },
]

export function AgencyOperations() {
  const { tab: urlTab } = useParams<{ tab?: string }>()
  const [activeTab, setActiveTab] = useState(urlTab || 'onboarding')

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 6 }}>
          Operations Hub
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          Your agency configuration, SOPs, and operational infrastructure.
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '1px solid var(--hairline)',
          marginBottom: 'var(--space-6)',
          overflowX: 'auto',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              fontSize: '13.5px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--violet)' : 'var(--ink-2)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--violet)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 120ms ease',
              marginBottom: '-1px',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.01em',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Onboarding tab content */}
      {activeTab === 'onboarding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div
            style={{
              background: 'var(--lavender-soft)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-5)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <p style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 6 }}>
                Readiness Score
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
                20%
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: 'var(--space-1)' }}>1 of 5 steps complete</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-5)' }}>Complete all steps to unlock full functionality</p>
            </div>
          </div>

          {ONBOARDING_STEPS.map(step => (
            <Card
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-4)',
                opacity: step.done ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-full)',
                  background: step.done ? 'var(--success)' : 'var(--surface-3)',
                  border: `2px solid ${step.done ? 'var(--success)' : 'var(--hairline)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: step.done ? 'white' : 'var(--ink-4)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {step.done ? '✓' : step.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>{step.title}</p>
                  {step.done && <Badge variant="success">Complete</Badge>}
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>{step.desc}</p>
              </div>
              {!step.done && (
                <button
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--lavender-soft)',
                    border: '1px solid var(--hairline)',
                    color: 'var(--violet)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Start →
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Other tabs — placeholder */}
      {activeTab !== 'onboarding' && (
        <Card>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--space-10) 0' }}>
            {TABS.find(t => t.id === activeTab)?.label} — coming in Phase 03
          </p>
        </Card>
      )}
    </div>
  )
}
