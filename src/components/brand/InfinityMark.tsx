import { useEffect, useRef } from 'react'

interface InfinityMarkProps {
  size?: number
  variant?: 'light' | 'dark' | 'gradient'
  animated?: boolean
  className?: string
}

export function InfinityMark({
  size = 64,
  variant = 'gradient',
  animated = true,
  className = '',
}: InfinityMarkProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (!animated) return
    const path = pathRef.current as SVGPathElement
    const glow = glowRef.current as SVGPathElement
    if (!path || !glow) return

    const len = path.getTotalLength()
    path.style.strokeDasharray  = `${len}`
    path.style.strokeDashoffset = `${len}`
    glow.style.strokeDasharray  = `${len * 0.25}`
    glow.style.strokeDashoffset = `${len}`

    let raf: number
    let start: number | null = null
    const DURATION = 3200

    function tick(ts: number) {
      if (!start) start = ts
      const elapsed = (ts - start) % DURATION
      const pct = elapsed / DURATION

      // Main stroke: draws in fully then stays
      const drawPct = Math.min(pct * 2, 1)
      path.style.strokeDashoffset = `${len * (1 - drawPct)}`

      // Glow streak: travels the full path continuously
      const glowOffset = len - (pct * len * 1.25) % len
      glow.style.strokeDashoffset = `${glowOffset}`

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animated])

  const w = size * 2.4
  const h = size

  const strokeColor = variant === 'light'
    ? 'rgba(255,255,255,0.9)'
    : variant === 'dark'
    ? 'var(--brand-600)'
    : 'url(#infinityGradient)'

  const glowColor = variant === 'light'
    ? 'rgba(255,255,255,1)'
    : 'rgba(192,155,217,1)'

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="infinityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="var(--brand-300)" />
          <stop offset="50%"  stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--brand-200)" />
        </linearGradient>

        <filter id="infinityGlow" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glowStreak" x="-40%" y="-100%" width="180%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle track */}
      <path
        d={`M ${w * 0.5} ${h * 0.5}
            C ${w * 0.5} ${h * 0.08}, ${w * 0.72} ${h * 0.08}, ${w * 0.75} ${h * 0.5}
            C ${w * 0.78} ${h * 0.92}, ${w * 1.0} ${h * 0.92}, ${w * 1.0} ${h * 0.5}
            C ${w * 1.0} ${h * 0.08}, ${w * 0.78} ${h * 0.08}, ${w * 0.75} ${h * 0.5}
            C ${w * 0.72} ${h * 0.92}, ${w * 0.5} ${h * 0.92}, ${w * 0.5} ${h * 0.5}
            C ${w * 0.5} ${h * 0.08}, ${w * 0.28} ${h * 0.08}, ${w * 0.25} ${h * 0.5}
            C ${w * 0.22} ${h * 0.92}, ${w * 0.0} ${h * 0.92}, ${w * 0.0} ${h * 0.5}
            C ${w * 0.0} ${h * 0.08}, ${w * 0.22} ${h * 0.08}, ${w * 0.25} ${h * 0.5}
            C ${w * 0.28} ${h * 0.92}, ${w * 0.5} ${h * 0.92}, ${w * 0.5} ${h * 0.5}`}
        stroke={variant === 'light' ? 'rgba(255,255,255,0.1)' : 'var(--brand-100)'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Main animated stroke */}
      <path
        ref={pathRef}
        d={`M ${w * 0.5} ${h * 0.5}
            C ${w * 0.5} ${h * 0.08}, ${w * 0.72} ${h * 0.08}, ${w * 0.75} ${h * 0.5}
            C ${w * 0.78} ${h * 0.92}, ${w * 1.0} ${h * 0.92}, ${w * 1.0} ${h * 0.5}
            C ${w * 1.0} ${h * 0.08}, ${w * 0.78} ${h * 0.08}, ${w * 0.75} ${h * 0.5}
            C ${w * 0.72} ${h * 0.92}, ${w * 0.5} ${h * 0.92}, ${w * 0.5} ${h * 0.5}
            C ${w * 0.5} ${h * 0.08}, ${w * 0.28} ${h * 0.08}, ${w * 0.25} ${h * 0.5}
            C ${w * 0.22} ${h * 0.92}, ${w * 0.0} ${h * 0.92}, ${w * 0.0} ${h * 0.5}
            C ${w * 0.0} ${h * 0.08}, ${w * 0.22} ${h * 0.08}, ${w * 0.25} ${h * 0.5}
            C ${w * 0.28} ${h * 0.92}, ${w * 0.5} ${h * 0.92}, ${w * 0.5} ${h * 0.5}`}
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        filter="url(#infinityGlow)"
        style={{ transition: 'none' }}
      />

      {/* Travelling glow streak */}
      {animated && (
        <path
          ref={glowRef}
          d={`M ${w * 0.5} ${h * 0.5}
              C ${w * 0.5} ${h * 0.08}, ${w * 0.72} ${h * 0.08}, ${w * 0.75} ${h * 0.5}
              C ${w * 0.78} ${h * 0.92}, ${w * 1.0} ${h * 0.92}, ${w * 1.0} ${h * 0.5}
              C ${w * 1.0} ${h * 0.08}, ${w * 0.78} ${h * 0.08}, ${w * 0.75} ${h * 0.5}
              C ${w * 0.72} ${h * 0.92}, ${w * 0.5} ${h * 0.92}, ${w * 0.5} ${h * 0.5}
              C ${w * 0.5} ${h * 0.08}, ${w * 0.28} ${h * 0.08}, ${w * 0.25} ${h * 0.5}
              C ${w * 0.22} ${h * 0.92}, ${w * 0.0} ${h * 0.92}, ${w * 0.0} ${h * 0.5}
              C ${w * 0.0} ${h * 0.08}, ${w * 0.22} ${h * 0.08}, ${w * 0.25} ${h * 0.5}
              C ${w * 0.28} ${h * 0.92}, ${w * 0.5} ${h * 0.92}, ${w * 0.5} ${h * 0.5}`}
          stroke={glowColor}
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glowStreak)"
          style={{ transition: 'none' }}
        />
      )}
    </svg>
  )
}
