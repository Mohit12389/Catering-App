"use client"

import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive'
}

export function Badge({ className, variant = 'primary', ...props }: BadgeProps) {
  const variantClasses = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    success: 'badge-success',
    warning: 'badge-warning',
    destructive: 'badge-destructive',
  }

  return <span className={cn(variantClasses[variant], className)} {...props} />
}
