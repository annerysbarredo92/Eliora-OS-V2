import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, className, id, rows = 4, ...props }, ref) => {
    const taId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-[7px]">
        {label && (
          <label htmlFor={taId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          rows={rows}
          className={cn(
            'w-full px-[15px] py-3 resize-y',
            'font-[var(--font-sans)] text-[15px] text-[var(--ink)] leading-relaxed',
            'bg-[var(--surface-solid)] border border-[var(--hairline)] rounded-[14px]',
            'transition-all duration-[200ms]',
            'placeholder:text-[var(--muted)]',
            'focus:outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_4px_var(--lavender-soft)]',
            className
          )}
          {...props}
        />
        {hint && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
