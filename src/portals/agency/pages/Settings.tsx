import { Card } from '@/components/ui/Card'

export function AgencySettings() {
  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 400,
            color: 'var(--ink)',
            marginBottom: 'var(--space-1)',
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)' }}>
          Configure your workspace, branding, and preferences.
        </p>
      </div>

      <Card>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--space-10) 0' }}>
          Settings — coming in Phase 02+
        </p>
      </Card>
    </div>
  )
}
