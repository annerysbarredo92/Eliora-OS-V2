import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glass?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddings = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
}

export function Card({ hover = false, glass = false, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        glass
          ? 'bg-[var(--surface)] backdrop-blur-[22px] saturate-150'
          : 'bg-[var(--surface-solid)]',
        'border border-[var(--hairline)] rounded-[var(--radius)]',
        'shadow-[var(--shadow-glass)]',
        paddings[padding],
        hover && 'transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
