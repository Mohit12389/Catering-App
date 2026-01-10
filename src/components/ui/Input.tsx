"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, hint, error, id, ...props }, ref) => {
    const inputId = id || React.useId()
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label mb-1.5 block">
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn("input", error && "border-destructive", className)}
          ref={ref}
          {...props}
        />
        {hint && !error && <p className="hindi-hint">{hint}</p>}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
