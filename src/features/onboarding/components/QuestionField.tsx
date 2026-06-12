import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { OnboardingQuestion } from '@/types'

interface QuestionFieldProps {
  question: OnboardingQuestion
  value: unknown
  onChange: (value: unknown) => void
}

export function QuestionField({ question: q, value, onChange }: QuestionFieldProps) {
  const label = q.is_required ? `${q.label} *` : q.label
  const str = typeof value === 'string' ? value : value == null ? '' : String(value)

  switch (q.question_type) {
    case 'textarea':
      return <Textarea label={label} value={str} onChange={e => onChange(e.target.value)} hint={q.help_text ?? undefined} rows={3} />

    case 'select':
      return (
        <Select
          label={label}
          value={str}
          onChange={e => onChange(e.target.value)}
          options={[{ value: '', label: 'Select…' }, ...q.options.map(o => ({ value: o, label: o }))]}
        />
      )

    case 'multiselect': {
      const arr: string[] = Array.isArray(value) ? (value as string[]) : []
      const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o])
      return (
        <div className="flex flex-col gap-[7px]">
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {q.options.map(o => {
              const on = arr.includes(o)
              return (
                <button key={o} type="button" onClick={() => toggle(o)}
                  style={{
                    padding: '8px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', transition: 'all 140ms ease',
                    border: `1px solid ${on ? 'var(--violet)' : 'var(--hairline)'}`,
                    background: on ? 'var(--violet)' : 'var(--surface-solid)',
                    color: on ? '#fff' : 'var(--ink-2)',
                  }}>
                  {o}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    case 'upload':
      return (
        <div className="flex flex-col gap-[7px]">
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{q.label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', border: '1px dashed var(--hairline)', borderRadius: 14, background: 'var(--bg)', color: 'var(--muted)', fontSize: 13 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
            File uploads arrive in a later phase — track this in Asset Uploads.
          </div>
        </div>
      )

    case 'number':
      return <Input label={label} value={str} onChange={e => onChange(e.target.value)} inputMode="numeric" hint={q.help_text ?? undefined} />

    case 'social':
      return <Input label={label} value={str} onChange={e => onChange(e.target.value)} placeholder="@handle or URL" hint={q.help_text ?? undefined} />

    case 'url':
      return <Input label={label} value={str} onChange={e => onChange(e.target.value)} placeholder="https://" hint={q.help_text ?? undefined} />

    case 'email':
      return <Input label={label} type="email" value={str} onChange={e => onChange(e.target.value)} hint={q.help_text ?? undefined} />

    case 'phone':
      return <Input label={label} value={str} onChange={e => onChange(e.target.value)} placeholder="(555) 000-0000" hint={q.help_text ?? undefined} />

    default:
      return <Input label={label} value={str} onChange={e => onChange(e.target.value)} hint={q.help_text ?? undefined} />
  }
}

/** Render a stored answer as readable text (for review + agency view). */
export function answerText(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}
