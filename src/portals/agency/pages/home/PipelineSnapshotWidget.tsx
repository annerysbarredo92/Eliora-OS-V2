import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { money } from '@/features/operations/helpers'
import type { StageSummary } from '@/features/projects/api'

const STAGE_COLOR: Record<string, string> = {
  'New Inquiry / Lead': '#6D3DE6',
  'Discovery Call':     '#4F8EF7',
  'Proposal Sent':      '#F0A443',
  'Proposal Signed':    '#10B981',
  'Onboarding':         '#9258EE',
  'Client':             '#059669',
}

interface Props {
  summary: StageSummary[]
  loading: boolean
}

export function PipelineSnapshotWidget({ summary, loading }: Props) {
  const navigate = useNavigate()

  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Pipeline Snapshot</p>

      {loading ? (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ flexShrink: 0, width: 90, height: 64, borderRadius: 10, background: 'var(--lavender-soft)', opacity: 0.4 }} />
          ))}
        </div>
      ) : summary.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>No pipeline stages yet.</p>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
          {summary.map((s, i) => {
            const color = STAGE_COLOR[s.name] ?? 'var(--violet)'
            return (
              <Fragment key={s.id}>
                <button
                  onClick={() => navigate('/agency/projects')}
                  style={{
                    flexShrink: 0, minWidth: 90, padding: '10px 12px',
                    background: `${color}10`, border: `1.5px solid ${color}35`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-sans)', transition: 'all 160ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}20`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}60` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}10`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}35` }}
                >
                  <p style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: '-0.04em', marginBottom: 1, lineHeight: 1 }}>{s.count}</p>
                  {s.total_cents > 0 && <p style={{ fontSize: 9.5, color, opacity: 0.75, marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>{money(s.total_cents)}</p>}
                  <p style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1.3 }}>{s.name}</p>
                </button>
                {i < summary.length - 1 && (
                  <span style={{ color: 'var(--hairline)', fontSize: 14, flexShrink: 0 }}>›</span>
                )}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
