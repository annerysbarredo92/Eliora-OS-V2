import { useEffect, useRef } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => cancelRef.current?.focus())

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="presentation"
      onMouseDown={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(26,20,48,0.42)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onMouseDown={e => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface-solid)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-glass)',
          padding: '24px',
        }}
      >
        <h2
          id="confirm-title"
          style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.02em' }}
        >
          {title}
        </h2>
        <p
          id="confirm-desc"
          style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 24 }}
        >
          {description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button ref={cancelRef} variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
