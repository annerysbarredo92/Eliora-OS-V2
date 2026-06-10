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
  'inline-flex items-center justify-center gap-2',
  'font-sans font-medium rounded-[var(--radius)]',
  'transition-all duration-[var(--duration)] ease-[var(--ease)]',
  'cursor-pointer select-none',
  'disabled:opacity-50 disabled:pointer-events-none',
  'focus-visible:outline-2 focus-visible:outline-[var(--brand-500)] focus-visible:outline-offset-2',
].join(' ')

const variants: Record<Variant, string> = {
  primary:   'bg-[var(--brand-500)] text-white hover:bg-[var(--brand-400)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)]',
  secondary: 'bg-[var(--brand-50)] text-[var(--brand-500)] hover:bg-[var(--brand-100)]',
  ghost:     'bg-transparent text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  danger:    'bg-[var(--danger)] text-white hover:opacity-90',
  outline:   'bg-transparent border border-[var(--border-2)] text-[var(--ink-2)] hover:border-[var(--brand-300)] hover:text-[var(--brand-500)]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[var(--text-xs)]',
  md: 'h-10 px-5 text-[var(--text-sm)]',
  lg: 'h-12 px-7 text-[var(--text-base)]',
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
