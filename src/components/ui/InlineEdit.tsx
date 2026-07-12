import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void> | void
  placeholder?: string
  emptyText?: string
  displayStyle?: React.CSSProperties
  inputStyle?: React.CSSProperties
  validate?: (value: string) => string | null
}

export function InlineEdit({
  value,
  onSave,
  placeholder = 'Click to edit…',
  emptyText = '—',
  displayStyle,
  inputStyle,
  validate,
}: InlineEditProps) {
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState(value)
  const [error,    setError]    = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [editing, value])

  function cancel() {
    setEditing(false)
    setError(null)
    setDraft(value)
  }

  async function save() {
    const trimmed = draft.trim()
    if (validate) {
      const msg = validate(trimmed)
      if (msg) { setError(msg); return }
    }
    setSaving(true)
    try {
      await onSave(trimmed)
      setEditing(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(null) }}
            onKeyDown={onKey}
            onBlur={cancel}
            placeholder={placeholder}
            disabled={saving}
            style={{
              border: `1px solid ${error ? 'var(--danger)' : 'var(--violet)'}`,
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 13.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink)',
              background: 'var(--surface-solid)',
              outline: 'none',
              boxShadow: error ? '0 0 0 3px rgba(232,97,122,0.15)' : '0 0 0 3px var(--lavender-soft)',
              width: '100%',
              ...inputStyle,
            }}
          />
          <button
            onMouseDown={e => { e.preventDefault(); save() }}
            disabled={saving}
            aria-label="Save"
            style={{
              background: 'var(--violet)', border: 'none', borderRadius: 6,
              width: 28, height: 28, cursor: 'pointer', flexShrink: 0,
              display: 'grid', placeItems: 'center', color: '#fff',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
        {error && (
          <p style={{ fontSize: 11.5, color: 'var(--danger)' }}>{error}</p>
        )}
      </div>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="Click to edit"
      onClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditing(true) }}
      style={{
        cursor: 'text',
        borderRadius: 6,
        padding: '2px 4px',
        transition: 'background 150ms',
        display: 'inline-block',
        color: value ? 'var(--ink)' : 'var(--muted)',
        fontStyle: value ? 'normal' : 'italic',
        ...displayStyle,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--lavender-soft)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {value || emptyText}
    </span>
  )
}
