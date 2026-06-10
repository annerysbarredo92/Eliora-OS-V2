import { InfinityMark } from '@/components/brand/InfinityMark'

export function PublicFooter() {
  return (
    <footer
      style={{
        background: 'var(--brand-700)',
        padding: 'var(--space-12) var(--space-10)',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--content-max)',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <InfinityMark size={16} variant="light" animated={false} />
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-base)',
              fontWeight: 300,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Eliora
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>
          © {new Date().getFullYear()} Eliora OS · Built for premium agencies
        </p>
      </div>
    </footer>
  )
}
