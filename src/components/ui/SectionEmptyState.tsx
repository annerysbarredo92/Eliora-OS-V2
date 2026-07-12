import type { ReactNode } from 'react'
import { Button } from './Button'

interface SectionEmptyStateProps {
  icon?: ReactNode
  heading: string
  description: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}

export function SectionEmptyState({
  icon,
  heading,
  description,
  actionLabel,
  onAction,
  compact = false,
}: SectionEmptyStateProps) {
  return (
    <div
      style={{
        background: 'var(--surface-solid)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: compact ? '28px 20px' : '48px 32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 10 : 14,
      }}
    >
      {icon && (
        <div style={{
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          borderRadius: '50%',
          background: 'var(--lavender-soft)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--violet)',
        }}>
          {icon}
        </div>
      )}
      <div>
        <p style={{
          fontSize: compact ? 14 : 15,
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 6,
        }}>
          {heading}
        </p>
        <p style={{
          fontSize: compact ? 12.5 : 13.5,
          color: 'var(--muted)',
          lineHeight: 1.6,
          maxWidth: 360,
          margin: '0 auto',
        }}>
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
