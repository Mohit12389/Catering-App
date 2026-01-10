"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui"

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
  const handleDecrease = () => {
    const newValue = Math.max(min, value - step)
    onChange(newValue)
  }

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step)
    onChange(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0
    onChange(Math.min(max, Math.max(min, newValue)))
  }

  return (
    <div className="quantity-group">
      <button type="button" className="quantity-btn" onClick={handleDecrease}>
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        className="quantity-input"
        min={min}
        max={max}
        step={step}
      />
      <button type="button" className="quantity-btn" onClick={handleIncrease}>
        <Plus className="w-3 h-3" />
      </button>
      {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
    </div>
  )
}
