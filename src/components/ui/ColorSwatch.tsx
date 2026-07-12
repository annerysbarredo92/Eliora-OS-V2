import { useState } from 'react'

interface ColorSwatchProps {
  hex: string
  label?: string
  size?: number
}

export function ColorSwatch({ hex, label, size = 40 }: ColorSwatchProps) {
  const [copied, setCopied] = useState(false)

  const normalised = hex.startsWith('#') ? hex : `#${hex}`

  const isLight = (() => {
    const r = parseInt(normalised.slice(1, 3), 16) || 0
    const g = parseInt(normalised.slice(3, 5), 16) || 0
    const b = parseInt(normalised.slice(5, 7), 16) || 0
    return (r * 299 + g * 587 + b * 114) / 1000 > 180
  })()

  async function copy() {
    try {
      await navigator.clipboard.writeText(normalised)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      aria-label={`Copy color ${normalised}`}
      onClick={copy}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') copy() }}
    >
      <div
        title={`Click to copy ${normalised}`}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: normalised,
          border: isLight ? '1.5px solid var(--hairline)' : 'none',
          display: 'grid', placeItems: 'center',
          transition: 'transform 150ms ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
      >
        {copied && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLight ? '#000' : '#fff'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      {label && (
        <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', maxWidth: size + 8 }}>
          {copied ? 'Copied!' : label}
        </span>
      )}
      {!label && (
        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>
          {copied ? 'Copied!' : normalised.toUpperCase()}
        </span>
      )}
    </div>
  )
}
