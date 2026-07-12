type ProgressVariant = 'default' | 'success' | 'warning' | 'danger'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  variant?: ProgressVariant
  height?: number
  showPercent?: boolean
}

const TRACK_COLORS: Record<ProgressVariant, string> = {
  default: 'linear-gradient(90deg, var(--violet), var(--iris))',
  success: 'linear-gradient(90deg, #34BF93, #2da87e)',
  warning: 'linear-gradient(90deg, #E0A23A, #c88c2a)',
  danger:  'linear-gradient(90deg, #E8617A, #d44d64)',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  variant = 'default',
  height = 6,
  showPercent = false,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div style={{ width: '100%' }}>
      {(label || showPercent) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {label && (
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</span>
          )}
          {showPercent && (
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        style={{
          width: '100%',
          height,
          borderRadius: 9999,
          background: 'var(--lavender-soft)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 9999,
            background: TRACK_COLORS[variant],
            transition: 'width 400ms var(--ease-out)',
          }}
        />
      </div>
    </div>
  )
}
