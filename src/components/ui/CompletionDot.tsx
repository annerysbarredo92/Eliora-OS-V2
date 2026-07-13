import { useState } from 'react'

export type CompletionStatus = 'complete' | 'partial' | 'empty' | 'unknown'

interface CompletionDotProps {
  status: CompletionStatus
  tooltip?: string
  size?: number
}

const STATUS_STYLES: Record<CompletionStatus, React.CSSProperties> = {
  complete: { background: 'var(--violet)' },
  partial:  { background: 'var(--warning)' },
  empty:    { background: 'transparent', border: '1.5px solid var(--muted)' },
  unknown:  { background: 'transparent', border: '1.5px dashed var(--muted)', opacity: 0.45 },
}

const STATUS_LABEL: Record<CompletionStatus, string> = {
  complete: 'complete',
  partial:  'partially complete',
  empty:    'empty',
  unknown:  'status unavailable',
}

export function CompletionDot({ status, tooltip, size = 7 }: CompletionDotProps) {
  const [showTip, setShowTip] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span
        role="img"
        aria-label={`Section ${STATUS_LABEL[status]}`}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          transition: 'background 200ms ease',
          ...STATUS_STYLES[status],
        }}
      />
      {tooltip && showTip && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            right: 'calc(100% + 8px)',
            top: '50%',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: 6,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {tooltip}
        </span>
      )}
    </span>
  )
}
