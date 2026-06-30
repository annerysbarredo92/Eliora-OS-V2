import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-[7px]">
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ink-2)',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-[50px] px-[15px]',
            'font-[var(--font-sans)] text-[15px] text-[var(--ink)]',
            'bg-[var(--surface-solid)] border rounded-[14px]',
            'transition-all duration-[200ms]',
            'placeholder:text-[var(--muted)]',
            error
              ? 'border-[var(--danger)] focus:outline-none focus:border-[var(--danger)] focus:shadow-[0_0_0_4px_rgba(232,97,122,0.15)]'
              : 'border-[var(--hairline)] focus:outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_4px_var(--lavender-soft)]',
            className
          )}
          {...props}
        />
        {error && (
          <p style={{ fontSize: '12px', color: 'var(--danger)' }}>{error}</p>
        )}
        {hint && !error && (
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
