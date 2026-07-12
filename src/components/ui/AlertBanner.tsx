import { useState } from 'react'
import type { ReactNode } from 'react'

type AlertVariant = 'warning' | 'danger' | 'info' | 'success'

interface AlertBannerProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  action?: { label: string; onClick: () => void }
}

const VARIANT_STYLES: Record<AlertVariant, {
  bg: string; border: string; icon: string; title: string; text: string
}> = {
  warning: {
    bg: 'var(--warning-bg)', border: 'rgba(224,162,58,0.3)',
    icon: '#E0A23A', title: '#92600A', text: '#7A4F0A',
  },
  danger: {
    bg: 'var(--danger-bg)', border: 'rgba(232,97,122,0.3)',
    icon: '#E8617A', title: '#991B2A', text: '#7F1622',
  },
  info: {
    bg: 'var(--info-bg)', border: 'rgba(109,61,230,0.2)',
    icon: 'var(--violet)', title: 'var(--violet-700)', text: 'var(--violet-600)',
  },
  success: {
    bg: 'var(--success-bg)', border: 'rgba(52,191,147,0.3)',
    icon: '#34BF93', title: '#065F46', text: '#064E3B',
  },
}

const ICONS: Record<AlertVariant, ReactNode> = {
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  ),
  danger: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  ),
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
}

export function AlertBanner({
  variant = 'warning',
  title,
  children,
  dismissible = false,
  onDismiss,
  action,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const s = VARIANT_STYLES[variant]

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="alert"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 'var(--radius-sm)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ color: s.icon, flexShrink: 0, marginTop: 1 }}>{ICONS[variant]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <p style={{ fontSize: 13, fontWeight: 700, color: s.title, marginBottom: 3 }}>{title}</p>
        )}
        <div style={{ fontSize: 13, color: s.text, lineHeight: 1.55 }}>{children}</div>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              marginTop: 8, background: 'none', border: 'none',
              color: s.icon, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)',
            }}
          >
            {action.label} →
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: s.icon, padding: 2, flexShrink: 0,
            display: 'grid', placeItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
