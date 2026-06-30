import { useEffect, useId, useRef } from 'react'

const PATH = 'M160,100 C118,42 60,44 60,100 C60,156 118,158 160,100 C202,42 260,44 260,100 C260,156 202,158 160,100 Z'

interface InfinityMarkProps {
  size?: number
  draw?: boolean
  className?: string
}

export function InfinityMark({ size = 64, draw = false, className = '' }: InfinityMarkProps) {
  const uid     = useId().replace(/:/g, '')
  const gradId  = `${uid}g`
  const hiId    = `${uid}h`
  const filtId  = `${uid}f`
  const coreRef = useRef<SVGPathElement>(null)
  const hiRef   = useRef<SVGPathElement>(null)
  const trRef   = useRef<SVGPathElement>(null)
  const glassRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const core  = coreRef.current
    const hi    = hiRef.current
    const tr    = trRef.current
    const glass = glassRef.current
    if (!core || !hi || !tr || !glass) return

    const L   = core.getTotalLength()
    const seg = 46

    function startTravel() {
      if (!tr) return
      tr.style.strokeDasharray  = `${seg} ${L}`
      tr.style.opacity          = '1'
      tr.animate(
        [{ strokeDashoffset: '0' }, { strokeDashoffset: `${-(L + seg)}` }],
        { duration: 3400, iterations: Infinity, easing: 'linear' }
      )
    }

    if (draw) {
      core.style.strokeDasharray  = `${L}`
      core.style.strokeDashoffset = `${L}`
      hi.style.strokeDasharray    = `${L}`
      hi.style.strokeDashoffset   = `${L}`
      glass.style.opacity         = '0'
      tr.style.opacity            = '0'

      const a = core.animate(
        [{ strokeDashoffset: `${L}` }, { strokeDashoffset: '0' }],
        { duration: 2000, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' }
      )
      hi.animate(
        [{ strokeDashoffset: `${L}` }, { strokeDashoffset: '0' }],
        { duration: 2000, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' }
      )
      glass.animate(
        [{ opacity: '0' }, { opacity: '1' }],
        { duration: 1400, delay: 400, fill: 'forwards' }
      )
      a.onfinish = startTravel
    } else {
      startTravel()
    }
  }, [draw])

  const w = Math.round(size * 1.6)
  const h = size

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 320 200"
      style={{ width: w, height: h, overflow: 'visible' }}
      aria-label="Eliora"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="-60" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="#6D3DE6" />
          <stop offset="0.26" stopColor="#9258EE" />
          <stop offset="0.5"  stopColor="#C2A6F0" />
          <stop offset="0.68" stopColor="#EBD9B0" />
          <stop offset="0.82" stopColor="#F2CE5B" />
          <stop offset="0.93" stopColor="#CBB6E6" />
          <stop offset="1"    stopColor="#6D3DE6" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            from="-120 0"
            to="120 0"
            dur="6s"
            repeatCount="indefinite"
            additive="sum"
          />
        </linearGradient>
        <linearGradient id={hiId} x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0"   stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1"   stopColor="#fff" stopOpacity="0.45" />
        </linearGradient>
        <filter id={filtId} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* frosted glass body */}
      <path
        ref={glassRef}
        d={PATH}
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="40"
        strokeLinecap="round"
      />
      {/* iridescent core with blur glow */}
      <path
        ref={coreRef}
        d={PATH}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="29"
        strokeLinecap="round"
        filter={`url(#${filtId})`}
      />
      {/* specular highlight */}
      <path
        ref={hiRef}
        d={PATH}
        fill="none"
        stroke={`url(#${hiId})`}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* traveling light */}
      <path
        ref={trRef}
        d={PATH}
        fill="none"
        stroke="#fff"
        strokeWidth="10"
        strokeLinecap="round"
        style={{ opacity: 0 }}
      />
    </svg>
  )
}
