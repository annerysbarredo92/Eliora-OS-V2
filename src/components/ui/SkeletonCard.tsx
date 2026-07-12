interface SkeletonCardProps {
  height?: number | string
  lines?: number
  radius?: number | string
}

export function SkeletonCard({ height = 80, lines, radius = 'var(--radius)' }: SkeletonCardProps) {
  if (lines) {
    return (
      <div
        style={{
          background: 'var(--surface-solid)',
          border: '1px solid var(--hairline)',
          borderRadius: radius,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer"
            style={{
              height: 14,
              borderRadius: 6,
              width: i === lines - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className="animate-shimmer"
      style={{
        height,
        borderRadius: radius,
      }}
    />
  )
}

/** Renders N skeleton cards in a column. */
export function SkeletonList({ count = 3, height = 80 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </div>
  )
}
