import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const PLANS = [
  {
    name: 'Starter',
    price: '$97',
    period: '/month',
    desc: 'For solo consultants and small agencies just getting started.',
    features: ['Up to 5 clients', 'Client Portal', 'Content Studio', 'Basic Reports', 'Email support'],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$247',
    period: '/month',
    desc: 'For growing agencies ready to streamline operations at scale.',
    features: ['Up to 25 clients', 'Everything in Starter', 'Full Operations Hub', 'Team Hub', 'Automations', 'Priority support'],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Scale',
    price: '$497',
    period: '/month',
    desc: 'For established agencies running complex, multi-team operations.',
    features: ['Unlimited clients', 'Everything in Growth', 'AI Content Layer', 'Custom branding', 'Dedicated support'],
    cta: 'Start free trial',
    highlighted: false,
  },
]

export function PricingPage() {
  return (
    <div
      style={{
        paddingTop: 'calc(var(--header-height) + var(--space-16))',
        paddingBottom: 'var(--space-24)',
        padding: 'calc(var(--header-height) + var(--space-16)) var(--space-10) var(--space-24)',
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-16)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-4xl)',
            fontWeight: 400,
            color: 'var(--ink)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--ink-4)' }}>
          Start free for 14 days. No credit card required.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
      >
        {PLANS.map(plan => (
          <div
            key={plan.name}
            style={{
              background: plan.highlighted ? 'var(--brand-700)' : 'var(--surface)',
              border: `1px solid ${plan.highlighted ? 'transparent' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
              position: 'relative',
              boxShadow: plan.highlighted ? 'var(--shadow-xl)' : 'var(--shadow-sm)',
            }}
          >
            {plan.highlighted && (
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                }}
              >
                Most popular
              </div>
            )}

            <h3
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: plan.highlighted ? 'rgba(255,255,255,0.6)' : 'var(--ink-3)',
                marginBottom: 'var(--space-3)',
              }}
            >
              {plan.name}
            </h3>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'var(--text-4xl)',
                  fontWeight: 300,
                  color: plan.highlighted ? 'white' : 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {plan.price}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: plan.highlighted ? 'rgba(255,255,255,0.4)' : 'var(--ink-4)' }}>
                {plan.period}
              </span>
            </div>

            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)',
                marginBottom: 'var(--space-6)',
                lineHeight: 1.6,
              }}
            >
              {plan.desc}
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
              {plan.features.map(f => (
                <li
                  key={f}
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span style={{ color: plan.highlighted ? 'var(--accent-lt)' : 'var(--brand-300)', fontSize: '10px' }}>✦</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link to="/signup" style={{ display: 'block' }}>
              <Button
                variant={plan.highlighted ? 'secondary' : 'primary'}
                fullWidth
                style={plan.highlighted ? {
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.2)',
                } : {}}
              >
                {plan.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
