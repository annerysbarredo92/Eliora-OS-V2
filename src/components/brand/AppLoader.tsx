import { useEffect, useState } from 'react'
import { InfinityMark } from './InfinityMark'

interface AppLoaderProps {
  variant?: 'app' | 'website'
  onComplete?: () => void
  minDuration?: number
}

export function AppLoader({
  variant = 'app',
  onComplete,
  minDuration = 2400,
}: AppLoaderProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const holdTimer  = setTimeout(() => setPhase('hold'), 600)
    const exitTimer  = setTimeout(() => setPhase('exit'),  minDuration - 400)
    const doneTimer  = setTimeout(() => onComplete?.(), minDuration)

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
        background: 'var(--brand-700)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        zIndex: 9999,
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 400ms var(--ease)',
        pointerEvents: phase === 'exit' ? 'none' : 'all',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 700ms var(--ease-out), transform 700ms var(--ease-out)',
        }}
      >
        <InfinityMark size={40} variant="light" animated />

        <div
          style={{
            fontFamily: variant === 'website' ? 'var(--font-serif)' : 'var(--font-sans)',
            fontSize: variant === 'website' ? '2.5rem' : '2rem',
            fontWeight: variant === 'website' ? 300 : 300,
            letterSpacing: variant === 'website' ? '0.12em' : '0.3em',
            color: 'rgba(255, 255, 255, 0.92)',
          }}
        >
          {variant === 'website' ? 'Eliora' : 'E.'}
        </div>

        <div
          style={{
            width: '40px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(192,155,217,0.6), transparent)',
            opacity: phase === 'hold' ? 1 : 0,
            transition: 'opacity 600ms var(--ease-out) 400ms',
          }}
        />
      </div>
    </div>
  )
}
