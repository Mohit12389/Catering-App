"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import { Minus, Plus } from "lucide-react"

interface QuantityInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

export function QuantityInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
}: QuantityInputProps) {
  // Track the raw string the user is typing
  const [displayValue, setDisplayValue] = useState<string>(value ? String(value) : "")
  const [isFocused, setIsFocused] = useState(false)
  const prevValueRef = useRef(value)

  // Sync display when parent value changes externally (API load, reset, etc.)
  useEffect(() => {
    if (!isFocused && value !== prevValueRef.current) {
      setDisplayValue(value ? String(value) : "")
    }
    prevValueRef.current = value
  }, [value, isFocused])

  const handleDecrease = () => {
    const newValue = Math.max(min, value - step)
    onChange(newValue)
    setDisplayValue(newValue ? String(newValue) : "")
  }

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step)
    onChange(newValue)
    setDisplayValue(String(newValue))
  }

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    // Allow empty input (user cleared the field)
    if (raw === "") {
      setDisplayValue("")
      onChange(0)
      return
    }

    // Allow valid number patterns (including decimals like "0.5", "1.")
    if (/^\d*\.?\d*$/.test(raw)) {
      setDisplayValue(raw)
      const parsed = parseFloat(raw)
      if (!isNaN(parsed)) {
        onChange(Math.min(max, Math.max(min, parsed)))
      }
    }
  }, [onChange, min, max])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    // If value is 0, show empty so user can just type
    if (value === 0) {
      setDisplayValue("")
    } else {
      setDisplayValue(String(value))
    }
  }, [value])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // On blur, sync display with actual value
    if (value === 0) {
      setDisplayValue("")
    } else {
      setDisplayValue(String(value))
    }
  }, [value])

  // What to show in the input
  const shown = isFocused ? displayValue : (value === 0 ? "" : String(value))

  return (
    <div className="quantity-group">
      <button type="button" className="quantity-btn" onClick={handleDecrease}>
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="quantity-input"
        placeholder="0"
      />
      <button type="button" className="quantity-btn" onClick={handleIncrease}>
        <Plus className="w-3 h-3" />
      </button>
      {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
    </div>
  )
}