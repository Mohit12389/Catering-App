"use client"

import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      {Icon && <Icon className="empty-state-icon" />}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
