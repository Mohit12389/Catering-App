"use client"

import { ChevronDown, ChevronUp, Trash2, UtensilsCrossed, X } from "lucide-react"
import {
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"
import { Card, Badge } from "@/components/shared"
import { MEAL_TYPES } from "@/lib/meals"
import { formatDate, cn } from "@/lib/utils"

// =============================================
// ONE MEAL SECTION ON THE CREATE-EVENT FORM
// =============================================
// CHANGED: lifted out of create-event/page.tsx, which rendered this whole card inline
// inside a .map(). Fully controlled — the page owns the meals array, because the total
// and the earliest-date rule are computed across all of them.
//
// A booking is not one meal: a wedding might be breakfast on the 20th for 100 and
// dinner on the 21st for 200. Each gets its own date, guest count and per-plate price,
// which is why this card exists at all.

export interface MealSection {
  id: string
  functionDate: string
  mealType: string
  guestCount: string
  perPlatePrice: string
  selectedItems: { id: string; name: string }[]
  expanded: boolean
}

interface MealSectionCardProps {
  meal: MealSection
  index: number
  isActive: boolean
  /** Hidden for the last remaining meal — an event needs at least one. */
  canRemove: boolean
  onActivate: () => void
  onToggleExpanded: () => void
  onRemove: () => void
  onFieldChange: (field: keyof MealSection, value: string) => void
  onRemoveItem: (itemId: string) => void
}

export function MealSectionCard({
  meal, index, isActive, canRemove,
  onActivate, onToggleExpanded, onRemove, onFieldChange, onRemoveItem,
}: MealSectionCardProps) {
  const mealLabel = MEAL_TYPES.find(mt => mt.value === meal.mealType)?.label || `Meal ${index + 1}`

  return (
    <Card className={cn(isActive && "ring-2 ring-primary")}>
      <div
        className="flex items-center justify-between cursor-pointer p-1"
        onClick={() => { onActivate(); if (!meal.expanded) onToggleExpanded() }}
      >
        <div className="flex items-center gap-2">
          <UtensilsCrossed className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
          <span className="font-semibold">{meal.mealType ? mealLabel : `Meal ${index + 1}`}</span>
          {meal.functionDate && <span className="text-xs text-muted-foreground">({formatDate(meal.functionDate)})</span>}
          {meal.guestCount && <Badge variant="secondary" className="text-xs">{meal.guestCount} guests</Badge>}
          <Badge variant={isActive ? "primary" : "secondary"} className="text-xs">{meal.selectedItems.length} items</Badge>
          {isActive && <Badge variant="success" className="text-xs">Active</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {canRemove && (
            <Button
              type="button" variant="ghost" size="icon"
              className="h-7 w-7 text-destructive"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onToggleExpanded() }}
          >
            {meal.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {meal.expanded && (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label mb-1 block text-xs">Date / तारीख *</label>
              <Input type="date" value={meal.functionDate} onChange={e => onFieldChange("functionDate", e.target.value)} />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Meal Type *</label>
              <Select value={meal.mealType} onValueChange={v => onFieldChange("mealType", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(mt => (<SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="label mb-1 block text-xs">Guests *</label>
              <Input type="number" placeholder="0" value={meal.guestCount} onChange={e => onFieldChange("guestCount", e.target.value)} />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Per Plate (₹)</label>
              <Input type="number" placeholder="0" value={meal.perPlatePrice} onChange={e => onFieldChange("perPlatePrice", e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Selected Items ({meal.selectedItems.length})
              {!isActive && (
                <span className="ml-2 text-primary cursor-pointer" onClick={onActivate}>
                  ← click to add items here
                </span>
              )}
            </p>
            {meal.selectedItems.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                {isActive ? "Use the search below to add items" : "Click this meal to select it, then search items"}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {meal.selectedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm">
                    <span className="font-medium">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="w-4 h-4 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
