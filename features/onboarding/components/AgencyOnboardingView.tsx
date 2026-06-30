import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { answerText } from './QuestionField'
import { readProgress, statusLabel, statusBadge } from '../helpers'
import { relativeTime } from '@/features/clients/helpers'
import type { OnboardingTemplate, OnboardingProgress, OnboardingRequiredItem, OnboardingActivity } from '@/types'

interface AgencyOnboardingViewProps {
  template: OnboardingTemplate | null
  responses: Record<string, unknown>
  progress: OnboardingProgress | null
  requiredItems: OnboardingRequiredItem[]
  activity: OnboardingActivity[]
  loading: boolean
}

export function AgencyOnboardingView({ template, responses, progress, requiredItems, activity, loading }: AgencyOnboardingViewProps) {
  if (loading) {
    return <div style={{ height: 300, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} />
  }
  if (!template) {
    return <p style={{ fontSize: 13.5, color: 'var(--muted)', padding: '20px 0' }}>No onboarding template found. Open Operations → Templates to set it up.</p>
  }

  const { pct, status, missing, completed, total, lastSaved } = readProgress(progress)
  const dataSections = template.sections.filter(s => s.key !== 'review').sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Summary */}
      <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{pct}%</span>
            <Badge variant={statusBadge(status)}>{statusLabel(status)}</Badge>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{completed} of {total} sections · {missing.length} missing</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Updated {relativeTime(lastSaved)}</p>
          </div>
        </div>
        <div style={{ height: 6, background: 'var(--lavender-soft)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#6D3DE6,#9258EE)', borderRadius: 999 }} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Button variant="outline" size="sm" disabled title="Coming in a later phase">Request missing info</Button>
        </div>
      </div>

      {/* Missing items */}
      {missing.length > 0 && (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(224,162,58,0.25)', borderRadius: 14, padding: '12px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 6 }}>Missing required items</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map((m, i) => <Badge key={i} variant="warning">{m.label}</Badge>)}
          </div>
        </div>
      )}

      {/* Answers by section */}
      {dataSections.map(s => (
        <div key={s.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{s.title}</h4>
            {progress?.sections?.[s.key] && <Badge variant="success">Done</Badge>}
          </div>
          {s.key === 'assets' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {requiredItems.length === 0
                ? <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>No items.</span>
                : requiredItems.map(it => <Badge key={it.id} variant={it.is_provided ? 'success' : 'default'}>{it.label}{it.is_provided ? ' ✓' : ''}</Badge>)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {s.questions.map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--hairline-2)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{q.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{answerText(responses[q.id])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Activity timeline */}
      <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 18 }}>
        <h4 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Activity timeline</h4>
        {activity.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No onboarding activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activity.map(a => (
              <li key={a.id} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'flex-start' }}>
                <span style={{ marginTop: 6, width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: 'var(--lavender)' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: 'var(--ink)' }}>{a.description || a.action}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{relativeTime(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
