import { Card } from '@/components/ui/Card'

export function ClientOnboarding() {
  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 400,
            color: 'var(--ink)',
            marginBottom: 'var(--space-1)',
          }}
        >
          Getting Started
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Complete your onboarding to get the most from Eliora.
        </p>
      </div>

      <Card>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--space-10) 0' }}>
          Getting Started — coming soon
        </p>
      </Card>
    </div>
  )
}
