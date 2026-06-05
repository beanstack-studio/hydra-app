import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary text-secondary-foreground border-secondary',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  outline: 'bg-transparent text-foreground border-border',
  success: 'bg-green-50 text-green-700 border-green-200',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
