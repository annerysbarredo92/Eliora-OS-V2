import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, options, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-[7px]">
        {label && (
          <label htmlFor={selectId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full h-[50px] px-[15px] pr-10 appearance-none',
              'font-[var(--font-sans)] text-[15px] text-[var(--ink)]',
              'bg-[var(--surface-solid)] border border-[var(--hairline)] rounded-[14px]',
              'transition-all duration-[200ms] cursor-pointer',
              'focus:outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_4px_var(--lavender-soft)]',
              className
            )}
            {...props}
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {hint && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
