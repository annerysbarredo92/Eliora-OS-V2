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
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-10 px-3.5',
            'text-[var(--text-sm)] text-[var(--ink)]',
            'bg-[var(--surface)] border rounded-[var(--radius)]',
            'transition-colors duration-[var(--duration-fast)]',
            'placeholder:text-[var(--ink-5)]',
            error
              ? 'border-[var(--danger)] focus:outline-[var(--danger)]'
              : 'border-[var(--border)] focus:border-[var(--brand-500)] focus:outline-[var(--brand-500)]',
            className
          )}
          {...props}
        />
        {error && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{error}</p>
        )}
        {hint && !error && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
