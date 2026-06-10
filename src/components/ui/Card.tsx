import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddings = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
}

export function Card({ hover = false, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)]',
        'shadow-[var(--shadow-sm)]',
        paddings[padding],
        hover && 'transition-shadow duration-[var(--duration)] hover:shadow-[var(--shadow)] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
