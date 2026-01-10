"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingProps {
  className?: string
  size?: 'sm' | 'default' | 'lg'
  text?: string
}

export function Loading({ className, size = 'default', text }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div className={cn("loading-center", className)}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
  )
}

export function LoadingSpinner({ className }: { className?: string }) {
  return <div className={cn("loading-spinner", className)} />
}
