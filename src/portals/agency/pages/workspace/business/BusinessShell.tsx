import { useSearchParams } from 'react-router-dom'
import { BusinessOverview } from './BusinessOverview'
import { CompanySection } from './CompanySection'
import { ContactsSection } from './ContactsSection'
import type { Client } from '@/types'

const SECTIONS = [
  { id: 'overview',           label: 'Overview' },
  { id: 'company',            label: 'Company' },
  { id: 'contacts',           label: 'Contacts' },
  { id: 'brand',              label: 'Brand Center' },
  { id: 'products',           label: 'Products & Services' },
  { id: 'goals',              label: 'Goals' },
  { id: 'competitors',        label: 'Competitors' },
  { id: 'discovery',          label: 'Discovery' },
  { id: 'deals',              label: 'Deals' },
  { id: 'connected_accounts', label: 'Connected Accounts' },
]

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function BusinessShell({ client, ctx, onChanged }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') ?? 'overview'

  function changeSection(id: string) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.set('section', id)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div>
      <nav
        className="overflow-x-auto"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--hairline)',
          marginBottom: 22,
          scrollbarWidth: 'none',
        }}
      >
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => changeSection(s.id)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              fontWeight: section === s.id ? 600 : 400,
              color: section === s.id ? 'var(--violet)' : 'var(--ink-2)',
              background: 'none',
              border: 'none',
              borderBottom: section === s.id ? '2px solid var(--violet)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -1,
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === 'overview' && (
        <BusinessOverview client={client} ctx={ctx} onSectionChange={changeSection} />
      )}
      {section === 'company' && (
        <CompanySection client={client} ctx={ctx} onChanged={onChanged} />
      )}
      {section === 'contacts' && (
        <ContactsSection client={client} ctx={ctx} onChanged={onChanged} />
      )}
      {section !== 'overview' && section !== 'company' && section !== 'contacts' && (
        <SectionPlaceholder
          label={SECTIONS.find(s => s.id === section)?.label ?? section}
          onBack={() => changeSection('overview')}
        />
      )}
    </div>
  )
}

function SectionPlaceholder({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div
      style={{
        background: 'var(--surface-solid)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: '56px 32px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 360, margin: '8px auto 24px' }}>
        This section is coming in the next sprint.
      </p>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--violet)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        ← Back to Overview
      </button>
    </div>
  )
}
