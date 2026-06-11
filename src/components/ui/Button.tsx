import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const base = [
  'inline-flex items-center justify-center gap-1.5',
  'font-[var(--font-sans)] font-semibold rounded-[9999px]',
  'transition-all duration-[200ms]',
  'cursor-pointer select-none',
  'disabled:opacity-50 disabled:pointer-events-none',
  'focus-visible:outline-2 focus-visible:outline-[var(--violet)] focus-visible:outline-offset-2',
  '[&_svg]:w-[15px] [&_svg]:h-[15px]',
].join(' ')

const variants: Record<Variant, string> = {
  primary:   'bg-[var(--violet)] text-white shadow-[0_12px_26px_-10px_var(--violet)] hover:bg-[var(--violet-600)] hover:-translate-y-px',
  secondary: 'bg-[var(--lavender-soft)] text-[var(--violet)] hover:bg-[var(--lavender-soft)]/80',
  ghost:     'bg-transparent text-[var(--ink-2)] hover:bg-[var(--lavender-soft)] hover:text-[var(--violet)]',
  danger:    'bg-[var(--danger)] text-white hover:opacity-90',
  outline:   'bg-transparent border border-[var(--hairline)] text-[var(--ink-2)] hover:border-[var(--violet)] hover:text-[var(--violet)] hover:bg-[var(--lavender-soft)]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[12.5px]',
  md: 'h-9 px-4 text-[13.5px]',
  lg: 'h-11 px-6 text-[14px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
