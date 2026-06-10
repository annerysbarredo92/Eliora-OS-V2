import { Card } from '@/components/ui/Card'

export function ClientDashboard() {
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
          Dashboard
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Welcome to your client portal.
        </p>
      </div>

      <Card>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--space-10) 0' }}>
          Dashboard — coming soon
        </p>
      </Card>
    </div>
  )
}
