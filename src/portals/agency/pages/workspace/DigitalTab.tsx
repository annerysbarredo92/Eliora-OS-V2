const PILLARS = [
  { label: 'Website',      description: 'Manage client website pages, copy, and updates.',                   cta: 'Connect site' },
  { label: 'Landing Pages', description: 'Build and track campaign landing pages and conversion funnels.',   cta: 'Add page' },
  { label: 'Forms',        description: 'Lead capture forms, contact forms, and intake surveys.',            cta: 'Add form' },
  { label: 'Domains',      description: 'Domain management, DNS, and hosting records.',                      cta: 'Add domain' },
  { label: 'Integrations', description: 'CRM, email platform, and tool integrations for this client.',      cta: 'Connect' },
  { label: 'Automations',  description: 'Client-specific automations, triggers, and sequences.',             cta: 'Configure' },
]

export function DigitalTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Digital Infrastructure</p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Manage this client's digital footprint — websites, funnels, forms, domains, and integrations — all in one place.
        </p>
      </div>
      {/* Pillar cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
        {PILLARS.map(p => (
          <div key={p.label} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{p.label}</p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, flex: 1 }}>{p.description}</p>
            <button
              disabled
              style={{ marginTop: 14, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-sans)', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 8, color: 'var(--muted)', cursor: 'not-allowed', alignSelf: 'flex-start' }}
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
