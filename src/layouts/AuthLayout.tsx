import { Outlet, Link } from 'react-router-dom'
import { InfinityMark } from '@/components/brand/InfinityMark'

export function AuthLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '46% 54%' }}>

      {/* ── Brand panel ─────────────────────────────────── */}
      <aside
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0B0913',
          color: '#F3F1FA',
          padding: '40px 46px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* atmosphere orbs */}
        <div style={{ position: 'absolute', width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .55, filter: 'blur(85px)', top: -160, left: -120, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle,#F2CE5B,transparent 70%)', opacity: .26, filter: 'blur(85px)', bottom: -140, right: -100, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,#E86FB0,transparent 72%)', opacity: .2, filter: 'blur(85px)', top: '38%', right: -120, pointerEvents: 'none' }} />

        {/* logo lockup */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>
          <InfinityMark size={21} />
          <span>Eliora</span>
        </div>

        {/* center content */}
        <div style={{ position: 'relative', zIndex: 2, margin: 'auto 0', textAlign: 'left' }}>
          <div style={{ marginBottom: 30 }}>
            <InfinityMark size={94} draw />
          </div>
          <div style={{
            fontSize: 74,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            background: 'linear-gradient(105deg,#6D3DE6 0%,#9258EE 26%,#C2A6F0 50%,#EBD9B0 72%,#F2CE5B 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: 18,
          }}>
            E.
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 27, lineHeight: 1.3, color: '#EDEAF7', maxWidth: '18ch' }}>
            Run your whole agency in one <em style={{ color: '#C2A6F0' }}>calm</em> place.
          </div>
        </div>

        {/* footer quote */}
        <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.5, color: '#CFC9E2', maxWidth: '34ch' }}>
            "We replaced eight tools in a weekend — and our clients noticed the difference immediately."
          </div>
          <div style={{ marginTop: 14, fontSize: 13.5, color: '#938EB0' }}>
            <strong style={{ color: '#F3F1FA', fontWeight: 600 }}>Maya Ellison</strong> · Founder, Northlight Studio
          </div>
        </div>
      </aside>

      {/* ── Form panel ──────────────────────────────────── */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '32px 40px',
          position: 'relative',
          background: 'var(--bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              color: 'var(--ink-2)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Back to home
          </Link>
        </div>

        <div style={{ margin: 'auto', width: '100%', maxWidth: 404, padding: '38px 0' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
