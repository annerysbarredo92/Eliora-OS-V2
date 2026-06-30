import { useEffect, useState } from 'react'
import { InfinityMark } from './InfinityMark'

interface AppLoaderProps {
  onComplete?: () => void
  minDuration?: number
}

export function AppLoader({ onComplete, minDuration = 2800 }: AppLoaderProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 600)
    const exitTimer = setTimeout(() => setPhase('exit'),  minDuration - 400)
    const doneTimer = setTimeout(() => onComplete?.(),    minDuration)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [minDuration, onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0B0913',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 400ms ease',
        pointerEvents: phase === 'exit' ? 'none' : 'all',
        overflow: 'hidden',
      }}
    >
      {/* atmosphere orbs */}
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,#6D3DE6,transparent 70%)', opacity: 0.45, filter: 'blur(80px)', top: -140, left: -100 }} />
      <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,#F2CE5B,transparent 70%)', opacity: 0.2, filter: 'blur(80px)', bottom: -120, right: -80 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(10px)' : 'none',
          transition: 'opacity 700ms ease, transform 700ms ease',
        }}
      >
        <InfinityMark size={52} draw />

        <div
          style={{
            fontSize: '72px',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            background: 'linear-gradient(105deg,#6D3DE6 0%,#9258EE 26%,#C2A6F0 50%,#EBD9B0 72%,#F2CE5B 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          E.
        </div>

        <div
          style={{
            width: '48px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(183,156,239,0.6), transparent)',
            opacity: phase === 'hold' ? 1 : 0,
            transition: 'opacity 600ms ease 400ms',
          }}
        />
      </div>
    </div>
  )
}
