import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: 'violet' | 'gold' | 'success' | 'muted'
  placeholder?: boolean
}

const ACCENTS: Record<NonNullable<KpiCardProps['accent']>, string> = {
  violet:  'var(--violet)',
  gold:    'var(--gold)',
  success: 'var(--success)',
  muted:   'var(--muted)',
}

export function KpiCard({ label, value, hint, accent = 'violet', placeholder = false }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        backdropFilter: 'blur(22px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-glass)',
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        opacity: placeholder ? 0.62 : 1,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: ACCENTS[accent], opacity: 0.7 }} />
      <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
        {label}
      </p>
      <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>
        {value}
      </p>
      {hint && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{hint}</p>}
      {placeholder && (
        <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--lavender-soft)', padding: '3px 8px', borderRadius: 999 }}>
          Soon
        </span>
      )}
    </div>
  )
}
