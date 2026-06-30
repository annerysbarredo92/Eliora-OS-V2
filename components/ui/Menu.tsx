import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  soon?: boolean
  dividerBefore?: boolean
}

interface ActionMenuProps {
  items: MenuItem[]
  /** Accessible label for the trigger. */
  label?: string
  width?: number
}

/**
 * Three-dot action menu rendered through a portal to document.body, so it is
 * never clipped by a container's overflow:hidden (e.g. the clients table wrap).
 * Positions itself against the trigger, flips above when near the viewport
 * bottom, and closes on outside-click / scroll / Escape.
 */
export function ActionMenu({ items, label = 'Actions', width = 190 }: ActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setCoords(null); return }

    function place() {
      const t = triggerRef.current
      if (!t) return
      const r = t.getBoundingClientRect()
      const mw = menuRef.current?.offsetWidth ?? width
      const mh = menuRef.current?.offsetHeight ?? 220
      let left = r.right - mw
      if (left < 8) left = 8
      let top = r.bottom + 6
      if (top + mh > window.innerHeight - 8) top = r.top - mh - 6   // flip above
      if (top < 8) top = 8
      setCoords({ top, left })
    }

    place()
    const raf = requestAnimationFrame(place)   // re-measure after the menu mounts
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, width])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 30, height: 30, borderRadius: 8,
          border: '1px solid var(--hairline)', background: 'var(--surface-solid)',
          color: 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center',
          transition: 'all 140ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.color = 'var(--violet)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.color = 'var(--ink-2)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            visibility: coords ? 'visible' : 'hidden',
            minWidth: width,
            zIndex: 1000,
            background: 'var(--surface-solid)',
            border: '1px solid var(--hairline)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-md)',
            padding: 5,
          }}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.dividerBefore && <div style={{ height: 1, background: 'var(--hairline-2)', margin: '4px 0' }} />}
              <button
                role="menuitem"
                disabled={item.disabled}
                title={item.soon ? 'Coming in a later phase' : undefined}
                onClick={() => { if (!item.disabled) { setOpen(false); item.onClick?.() } }}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: 8, border: 'none',
                  background: 'transparent', cursor: item.disabled ? 'not-allowed' : 'pointer',
                  fontSize: 12.5, fontFamily: 'var(--font-sans)', fontWeight: 500,
                  color: item.danger ? 'var(--danger)' : item.disabled ? 'var(--muted)' : 'var(--ink)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = item.danger ? 'var(--danger-bg)' : 'var(--lavender-soft)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {item.label}
                {item.soon && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Soon</span>}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
