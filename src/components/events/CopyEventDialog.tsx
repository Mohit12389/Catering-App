"use client"

import { Copy } from "lucide-react"
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"
import { MEAL_TYPES } from "@/lib/meals"
import { formatDate } from "@/lib/utils"

// =============================================
// COPY EVENT DIALOG
// =============================================
// CHANGED: lifted out of event-history/[eventId]/page.tsx, which carried ~165 lines of
// this dialog inline. Controlled on purpose — the page still owns the form state and
// the meal selections, because it seeds them from the source event's meal groups and
// posts them. This component only renders and reports edits.
//
// Why per-meal selection exists: caterers reuse menus, but rarely the whole booking.
// You copy last month's Lunch onto a new date, possibly relabelled as Dinner.

export interface CopyMealSelection {
  originalLabel: string
  originalDate: string | null
  selected: boolean
  newMealType: string
  newDate: string
  newGuests: string
  newPerPlate: string
  itemCount: number
}

export interface CopyEventFormData {
  organizerName: string
  phoneNumber: string
  homeAddress: string
  location: string
}

interface CopyEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: CopyEventFormData
  onFormDataChange: (next: CopyEventFormData) => void
  meals: CopyMealSelection[]
  onMealsChange: (next: CopyMealSelection[]) => void
  /** Shown when a meal has no label of its own — the event's own time slot. */
  defaultMealLabel?: string | null
  onCopy: () => void
  copying: boolean
}

export function CopyEventDialog({
  open, onOpenChange, formData, onFormDataChange,
  meals, onMealsChange, defaultMealLabel, onCopy, copying,
}: CopyEventDialogProps) {
  const setField = (field: keyof CopyEventFormData, value: string) =>
    onFormDataChange({ ...formData, [field]: value })

  const setMeal = (idx: number, patch: Partial<CopyMealSelection>) =>
    onMealsChange(meals.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const selectedCount = meals.filter(m => m.selected).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            <Copy className="w-5 h-5 inline mr-2" />Copy Event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Section A: New Event Details — always typed fresh, never copied */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">New Event Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Organizer Name *"
                value={formData.organizerName}
                onChange={e => setField("organizerName", e.target.value)}
              />
              <Input
                label="Phone *"
                type="tel"
                value={formData.phoneNumber}
                onChange={e => setField("phoneNumber", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Home Address / घर का पता"
                value={formData.homeAddress}
                onChange={e => setField("homeAddress", e.target.value)}
              />
              <Input
                label="Venue Location / कार्यक्रम स्थल"
                value={formData.location}
                onChange={e => setField("location", e.target.value)}
              />
            </div>
          </div>

          {/* Section B: Select Meals to Copy */}
          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">
              Select Meals to Copy ({selectedCount}/{meals.length})
            </h3>

            {meals.map((meal, idx) => (
              <div
                key={idx}
                className={`p-3 border rounded-lg space-y-2 transition-colors ${
                  meal.selected ? "bg-primary/5 border-primary/30" : "opacity-50 bg-muted/30"
                }`}
              >
                {/* Meal checkbox + info */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={meal.selected}
                    onChange={e => setMeal(idx, { selected: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="font-medium capitalize">
                      {meal.originalLabel === "default" ? defaultMealLabel : meal.originalLabel}
                    </span>
                    {meal.originalDate && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (Source: {formatDate(meal.originalDate)})
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      — {meal.itemCount} items
                    </span>
                  </div>
                </div>

                {/* Editable fields (only when selected) */}
                {meal.selected && (
                  <div className="grid grid-cols-4 gap-2 ml-7">
                    <div>
                      <label className="label mb-1 block text-xs">Copy as</label>
                      <Select
                        value={meal.newMealType}
                        onValueChange={v => setMeal(idx, { newMealType: v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MEAL_TYPES.map(mt => (
                            <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Date *</label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={meal.newDate}
                        onChange={e => setMeal(idx, { newDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Guests</label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="0"
                        value={meal.newGuests}
                        onChange={e => setMeal(idx, { newGuests: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Per Plate ₹</label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="0"
                        value={meal.newPerPlate}
                        onChange={e => setMeal(idx, { newPerPlate: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Partial copies leave shared ingredients sized for meals that were left
              behind, so the quantities need a human to review them. */}
          {meals.some(m => !m.selected) && meals.some(m => m.selected) && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <p className="font-medium">⚠️ Partial copy</p>
              <p>Ingredients shared with unselected meals will be marked for review on the Event Menu page.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCopy} loading={copying} disabled={selectedCount === 0}>
            <Copy className="w-4 h-4 mr-2" />
            Copy {selectedCount} meal(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
