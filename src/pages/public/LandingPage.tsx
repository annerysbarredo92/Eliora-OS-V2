import { Link } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'
import { Button } from '@/components/ui/Button'

const FEATURES = [
  { title: 'Client Center',     desc: 'Full client profiles, onboarding, and relationship management in one organized space.' },
  { title: 'Content Studio',    desc: 'Plan, create, review, and approve content with structured workflows built for agencies.' },
  { title: 'Operations Hub',    desc: 'SOPs, templates, services, packages, and agency health — your entire operation, organized.' },
  { title: 'Client Portal',     desc: 'A premium portal your clients will love. Content approvals, files, reports, and communication.' },
  { title: 'Billing & Finance', desc: 'Invoices, subscriptions, and financial reporting without switching tools.' },
  { title: 'Reports',           desc: 'Branded performance reports your clients can access anytime in their portal.' },
]

export function LandingPage() {
  return (
    <div>
      {/* atmosphere */}
      <div className="atmos">
        <div className="orb a" />
        <div className="orb b" />
        <div className="orb c" />
      </div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 32px 90px',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <InfinityMark size={110} draw />
        </div>

        <h1
          style={{
            fontSize: 'clamp(56px,11vw,120px)',
            fontWeight: 600,
            letterSpacing: '-0.05em',
            lineHeight: 0.9,
            background: 'linear-gradient(105deg,#6D3DE6 0%,#9258EE 26%,#C2A6F0 50%,#EBD9B0 72%,#F2CE5B 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: 22,
          }}
        >
          Eliora
        </h1>

        <p
          style={{
            fontSize: 'clamp(18px,2.4vw,26px)',
            color: 'var(--ink-2)',
            maxWidth: 560,
            lineHeight: 1.4,
            marginBottom: 42,
          }}
        >
          The operating system for <em style={{ color: 'var(--violet)', fontStyle: 'normal' }}>premium</em> marketing agencies.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/signup">
            <Button variant="primary" size="lg">Start free trial</Button>
          </Link>
          <Link to="/pricing">
            <Button variant="outline" size="lg">View pricing</Button>
          </Link>
        </div>

        <p style={{ marginTop: 24, fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          No credit card required · 14-day free trial
        </p>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '108px 32px',
          maxWidth: 'var(--content-max)',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 54 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 18 }}>
            <span style={{ width: 22, height: 1.5, background: 'var(--violet)', opacity: 0.5, display: 'block' }} />
            Platform
          </div>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,44px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              color: 'var(--ink)',
              marginBottom: 18,
            }}
          >
            Everything your agency needs
          </h2>
          <p style={{ fontSize: 18, color: 'var(--ink-2)', maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
            Built specifically for marketing agencies who want to run at a premium level.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 22,
          }}
        >
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="glass"
              style={{ padding: 28, transition: 'transform 200ms ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', marginBottom: 8 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '100px 32px',
          textAlign: 'center',
        }}
      >
        <div className="glass" style={{ maxWidth: 600, margin: '0 auto', padding: '54px 46px', borderRadius: 'var(--radius-lg)' }}>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,40px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
              marginBottom: 16,
            }}
          >
            Ready to run a better agency?
          </h2>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 36, lineHeight: 1.6 }}>
            Join agencies already using Eliora OS.
          </p>
          <Link to="/signup">
            <Button variant="primary" size="lg">Get started free</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
