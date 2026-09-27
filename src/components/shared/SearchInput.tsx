"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

// CHANGED: the magnifier-icon + input (+ clear ✕) search box was copy-pasted across the
// app and the copies drifted (some had ✕, some didn't). This is the one shared version.

interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string
  onChange: (value: string) => void
  /** Extra work when ✕ is pressed (e.g. close a suggestions dropdown). The text is cleared either way. */
  onClear?: () => void
  /** Class for the outer wrapper — width, margins. `className` styles the input itself. */
  wrapperClassName?: string
  /** Smaller icon and text, for tight spots (e.g. the copy-recipe box). */
  compact?: boolean
}

export function SearchInput({
  value, onChange, onClear, wrapperClassName, compact, className, ...inputProps
}: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
      <input
        type="text"
        className={cn("input pr-9 w-full", compact ? "pl-9 text-sm" : "pl-10", className)}
        value={value}
        onChange={e => onChange(e.target.value)}
        {...inputProps}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => { onChange(""); onClear?.() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </button>
      )}
    </div>
  )
}
