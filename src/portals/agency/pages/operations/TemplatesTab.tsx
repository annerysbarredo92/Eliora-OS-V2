import { Badge } from '@/components/ui/Badge'

const TEMPLATE_TYPES = [
  { key: 'proposal',   title: 'Proposal Templates',   desc: 'Reusable proposals to win new clients.' },
  { key: 'invoice',    title: 'Invoice Templates',    desc: 'Branded invoices for billing.' },
  { key: 'report',     title: 'Report Templates',     desc: 'Performance report layouts.' },
  { key: 'content',    title: 'Content Templates',    desc: 'Repeatable content briefs and posts.' },
  { key: 'onboarding', title: 'Onboarding Templates', desc: 'Standardize client kickoff.' },
  { key: 'task',       title: 'Task Templates',       desc: 'Pre-built task checklists.' },
  { key: 'email',      title: 'Email Templates',      desc: 'Saved replies and sequences.' },
]

export function TemplatesTab() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Build a library of reusable templates. The full editor arrives in a later phase — these are the categories you'll fill.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {TEMPLATE_TYPES.map(t => (
          <div key={t.key} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, right: 14 }}><Badge variant="default">Soon</Badge></div>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{t.title}</p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
