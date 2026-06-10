import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--lavender-soft)] text-[var(--ink-2)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  danger:  'bg-[var(--danger-bg)] text-[var(--danger)]',
  info:    'bg-[var(--info-bg)] text-[var(--info)]',
  brand:   'bg-[var(--violet)] text-white shadow-[0_6px_14px_-4px_var(--violet)]',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full',
        'text-[11px] font-bold tracking-[0.08em] uppercase',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
