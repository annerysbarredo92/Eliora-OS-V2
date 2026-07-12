import { useState, useRef, type KeyboardEvent } from 'react'

interface ChipListProps {
  values: string[]
  onChange?: (values: string[]) => void
  placeholder?: string
  readOnly?: boolean
  variant?: 'default' | 'violet'
  maxItems?: number
}

export function ChipList({
  values,
  onChange,
  placeholder = 'Add item…',
  readOnly = false,
  variant = 'default',
  maxItems,
}: ChipListProps) {
  const [inputVal, setInputVal] = useState('')
  const [editing, setEditing]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const chipBg    = variant === 'violet' ? 'var(--lavender-soft)' : 'var(--surface-solid)'
  const chipColor = variant === 'violet' ? 'var(--violet)'       : 'var(--ink-2)'
  const chipBorder = variant === 'violet' ? 'rgba(109,61,230,0.2)' : 'var(--hairline)'

  function add() {
    const v = inputVal.trim()
    if (!v || !onChange) return
    if (maxItems && values.length >= maxItems) return
    if (values.includes(v)) { setInputVal(''); return }
    onChange([...values, v])
    setInputVal('')
  }

  function remove(val: string) {
    if (!onChange) return
    onChange(values.filter(v => v !== val))
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); add() }
    if (e.key === 'Escape') { setInputVal(''); setEditing(false); inputRef.current?.blur() }
    if (e.key === 'Backspace' && !inputVal && values.length) {
      remove(values[values.length - 1])
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: readOnly ? 0 : '8px',
        border: readOnly ? 'none' : `1px solid ${editing ? 'var(--violet)' : 'var(--hairline)'}`,
        borderRadius: readOnly ? 0 : 'var(--radius-sm)',
        boxShadow: (editing && !readOnly) ? '0 0 0 4px var(--lavender-soft)' : 'none',
        transition: 'all 200ms',
        background: readOnly ? 'transparent' : 'var(--surface-solid)',
        minHeight: readOnly ? 0 : 44,
        alignItems: 'center',
        cursor: readOnly ? 'default' : 'text',
      }}
      onClick={() => { if (!readOnly) inputRef.current?.focus() }}
    >
      {values.map(v => (
        <span
          key={v}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 9999,
            fontSize: 12.5, fontWeight: 500, color: chipColor,
            background: chipBg, border: `1px solid ${chipBorder}`,
          }}
        >
          {v}
          {!readOnly && onChange && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(v) }}
              aria-label={`Remove ${v}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, color: 'var(--muted)', lineHeight: 1,
                display: 'grid', placeItems: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </span>
      ))}

      {!readOnly && onChange && (!maxItems || values.length < maxItems) && (
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setEditing(true)}
          onBlur={() => { add(); setEditing(false) }}
          placeholder={values.length === 0 ? placeholder : ''}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12.5, color: 'var(--ink)', fontFamily: 'var(--font-sans)',
            minWidth: 80, flex: 1,
          }}
        />
      )}
    </div>
  )
}
