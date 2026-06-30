import { InfinityMark } from '@/components/brand/InfinityMark'

export function PublicFooter() {
  return (
    <footer
      style={{
        background: '#0B0913',
        padding: 'var(--space-12) 32px',
        marginTop: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: .25, filter: 'blur(80px)', bottom: -120, left: -60, pointerEvents: 'none' }} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--content-max)',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <InfinityMark size={18} />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#F3F1FA' }}>Eliora OS.M</span>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>
          © {new Date().getFullYear()} Eliora OS. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
