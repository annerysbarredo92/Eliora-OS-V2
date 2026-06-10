import { Link } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'
import { Button } from '@/components/ui/Button'

const FEATURES = [
  { title: 'Client Center',    desc: 'Full client profiles, onboarding, and relationship management in one organized space.' },
  { title: 'Content Studio',   desc: 'Plan, create, review, and approve content with structured workflows built for agencies.' },
  { title: 'Operations Hub',   desc: 'SOPs, templates, services, packages, and agency health — your entire operation, organized.' },
  { title: 'Client Portal',    desc: 'A premium portal your clients will love. Content approvals, files, reports, and communication.' },
  { title: 'Billing & Finance',desc: 'Invoices, subscriptions, and financial reporting without switching tools.' },
  { title: 'Reports',          desc: 'Branded performance reports your clients can access anytime in their portal.' },
]

export function LandingPage() {
  return (
    <div style={{ paddingTop: 'var(--header-height)' }}>

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(160deg, var(--brand-700) 0%, var(--brand-600) 60%, var(--brand-500) 100%)',
          padding: 'var(--space-24) var(--space-10)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 'var(--space-8)',
          minHeight: '80vh',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(192,155,217,0.12) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)' }}>
          <InfinityMark size={60} variant="light" animated />

          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                fontWeight: 300,
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.95)',
                lineHeight: 1.1,
                marginBottom: 'var(--space-5)',
              }}
            >
              The Operating System
              <br />
              <em style={{ fontStyle: 'italic', color: 'rgba(192,155,217,0.9)' }}>for Premium Agencies</em>
            </h1>

            <p
              style={{
                fontSize: 'var(--text-lg)',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '560px',
                lineHeight: 1.7,
                margin: '0 auto',
              }}
            >
              Eliora OS brings your clients, content, billing, and operations into one
              elegant workspace — so your agency can focus on doing its best work.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Link to="/signup">
              <Button variant="primary" size="lg">
                Start free trial
              </Button>
            </Link>
            <Link to="/pricing">
              <Button
                variant="outline"
                size="lg"
                style={{
                  borderColor: 'rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.75)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                View pricing
              </Button>
            </Link>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
            No credit card required · 14-day free trial
          </p>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          padding: 'var(--space-24) var(--space-10)',
          maxWidth: 'var(--content-max)',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-16)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 400,
              color: 'var(--ink)',
              marginBottom: 'var(--space-4)',
            }}
          >
            Everything your agency needs
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--ink-4)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.7 }}>
            Built specifically for marketing agencies who want to run at a premium level.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {FEATURES.map(f => (
            <div
              key={f.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-6)',
                transition: 'box-shadow var(--duration) var(--ease), border-color var(--duration) var(--ease)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                e.currentTarget.style.borderColor = 'var(--brand-200)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <h3
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: 'var(--brand-50)',
          padding: 'var(--space-20) var(--space-10)',
          textAlign: 'center',
          borderTop: '1px solid var(--brand-100)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 400,
            color: 'var(--brand-700)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Ready to run a better agency?
        </h2>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--ink-4)', marginBottom: 'var(--space-8)' }}>
          Join agencies already using Eliora OS.
        </p>
        <Link to="/signup">
          <Button variant="primary" size="lg">Get started free</Button>
        </Link>
      </section>
    </div>
  )
}
