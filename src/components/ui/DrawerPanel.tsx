import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface DrawerPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  /** When true, shows an "Unsaved changes" warning before closing. */
  hasUnsavedChanges?: boolean
}

export function DrawerPanel({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  hasUnsavedChanges = false,
}: DrawerPanelProps) {
  const panelRef  = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    prevFocus.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => !el.hasAttribute('disabled'))
        if (!focusable.length) return
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKey)

    // Focus the panel itself on open
    requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (firstFocusable) firstFocusable.focus()
      else panelRef.current?.focus()
    })

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prevFocus.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleClose() {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    onClose()
  }

  if (!open) return null

  return (
    <div
      role="presentation"
      onMouseDown={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(26,20,48,0.38)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={e => e.stopPropagation()}
        className="animate-slide-right drawer-panel-inner"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: width,
          background: 'var(--surface-solid)',
          borderLeft: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-glass)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--hairline-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            {title}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close panel"
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '1px solid var(--hairline)',
              background: 'var(--surface-solid)',
              color: 'var(--muted)', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              transition: 'all 150ms ease', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.color = 'var(--violet)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="drawer-panel-footer"
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--hairline-2)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              background: 'var(--bg)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Convenience footer builder — cancel + primary action. */
export function DrawerFooter({
  onCancel,
  onConfirm,
  confirmLabel = 'Save',
  loading = false,
  disabled = false,
  error,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  loading?: boolean
  disabled?: boolean
  error?: string | null
}) {
  return (
    <>
      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--danger)', flex: 1, alignSelf: 'center' }}>{error}</p>
      )}
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading} className="min-h-[44px]">Cancel</Button>
      <Button variant="primary" size="sm" onClick={onConfirm} loading={loading} disabled={disabled} className="min-h-[44px]">
        {confirmLabel}
      </Button>
    </>
  )
}
