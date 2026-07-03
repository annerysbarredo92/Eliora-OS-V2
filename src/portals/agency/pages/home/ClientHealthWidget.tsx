import { useNavigate } from 'react-router-dom'
import type { Client } from '@/types'

interface HealthCard { label: string; param: string; count: number; bg: string; border: string; text: string }

interface Props {
  clients: Client[]
  loading: boolean
}

export function ClientHealthWidget({ clients, loading }: Props) {
  const navigate = useNavigate()

  const active = clients.filter(c => c.status !== 'archived')

  const cards: HealthCard[] = [
    {
      label:  'Healthy',
      param:  'healthy',
      count:  active.filter(c => c.health === 'healthy').length,
      bg:     '#f0fdf4', border: '#86efac', text: '#15803d',
    },
    {
      label:  'Needs Attention',
      param:  'needs_attention',
      count:  active.filter(c => c.health === 'at_risk').length,
      bg:     '#fffbeb', border: '#fcd34d', text: '#b45309',
    },
    {
      label:  'At Risk',
      param:  'at_risk',
      count:  active.filter(c => c.health === 'critical').length,
      bg:     '#fff1f2', border: '#fca5a5', text: '#be123c',
    },
  ]

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Client Health</p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 50, borderRadius: 10, background: 'var(--lavender-soft)', opacity: 0.4 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {cards.map(card => (
            <button
              key={card.label}
              onClick={() => navigate(`/agency/projects?health=${card.param}`)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', borderRadius: 10,
                background: card.bg, border: `1.5px solid ${card.border}`,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                fontFamily: 'var(--font-sans)', transition: 'opacity 160ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.82' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              <div>
                <p style={{ fontSize: 20, fontWeight: 700, color: card.text, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 2 }}>{card.count}</p>
                <p style={{ fontSize: 10.5, fontWeight: 600, color: card.text }}>{card.label}</p>
              </div>
              <span style={{ fontSize: 13, color: card.border }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
