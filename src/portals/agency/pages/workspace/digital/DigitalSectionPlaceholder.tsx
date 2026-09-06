import type { DigitalSectionDef } from './sections'

// Structural entry surface for a section scheduled in a later Digital wave —
// preserves navigation without pretending the section is built. Mirrors
// BusinessSectionPlaceholder's visual pattern (workspace/business) with
// Digital-appropriate copy; kept as its own small component rather than a
// shared one for the same reason as DigitalErrorBoundary.
export function DigitalSectionPlaceholder({ section, onBack }: { section: DigitalSectionDef; onBack: () => void }) {
  return (
    <div
      className="animate-fade-in"
      style={{
        background: 'var(--surface-solid)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: '56px 32px',
        textAlign: 'center',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--lavender-soft)',
        display: 'grid', placeItems: 'center',
        margin: '0 auto 18px',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.02em' }}>
        {section.label}
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 24 }}>
        {section.description}
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 20 }}>
        Detailed build follows in a later Digital Workspace wave.
      </p>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none',
          color: 'var(--violet)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          padding: 0,
        }}
      >
        ← Back to Overview
      </button>
    </div>
  )
}
