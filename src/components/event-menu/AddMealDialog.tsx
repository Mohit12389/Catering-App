"use client"

import { useEffect, useState } from "react"
import { Plus, UtensilsCrossed, X } from "lucide-react"
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"
import { MEAL_TYPES } from "@/lib/meals"
import { CategoryItemPicker, type PickerCategory, type PickerItem } from "./CategoryItemPicker"

// CHANGED: lifted out of event-menu/[eventId]/page.tsx. The new-meal form fields and
// the chosen items live here — the page only needs them at the moment you press Add,
// so they are passed to onAdd rather than held in the page for the whole session.

export interface NewMeal {
  date: string
  mealType: string
  guests: string
  perPlate: string
  items: PickerItem[]
}

interface AddMealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: PickerCategory[]
  loadingCategories: boolean
  /** Guests is prefilled from the event's own guest count, as the page's button did. */
  defaultGuests?: string
  /** Resolves true when the meal saved, so this dialog can clear and close itself. */
  onAdd: (meal: NewMeal) => Promise<boolean>
  saving: boolean
}

export function AddMealDialog({
  open, onOpenChange, categories, loadingCategories, defaultGuests = "", onAdd, saving,
}: AddMealDialogProps) {
  const [date, setDate] = useState("")
  const [mealType, setMealType] = useState("")
  const [guests, setGuests] = useState("")
  const [perPlate, setPerPlate] = useState("")
  const [items, setItems] = useState<PickerItem[]>([])

  // Reset every time the dialog opens, which is what the page's Add Meal button used
  // to do inline — including seeding guests from the event.
  useEffect(() => {
    if (!open) return
    setDate(""); setMealType(""); setGuests(defaultGuests); setPerPlate(""); setItems([])
  }, [open, defaultGuests])

  const toggleItem = (item: PickerItem) =>
    setItems(prev => prev.some(i => i.id === item.id)
      ? prev.filter(i => i.id !== item.id)
      : [...prev, item])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5" />Add Meal / भोजन जोड़ें
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label mb-1 block text-xs">Date *</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Meal Type *</label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(mt => <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="label mb-1 block text-xs">Guests *</label>
              <Input type="number" placeholder="0" value={guests} onChange={e => setGuests(e.target.value)} />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Per Plate (₹)</label>
              <Input type="number" placeholder="0" value={perPlate} onChange={e => setPerPlate(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Selected Items ({items.length})</p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                Select items from below
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm">
                    <span className="font-medium">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                      className="w-4 h-4 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <CategoryItemPicker
            className="space-y-2 max-h-[250px] overflow-y-auto border rounded-lg p-2"
            categories={categories}
            loading={loadingCategories}
            compact
            isSelected={item => items.some(i => i.id === item.id)}
            onToggleItem={toggleItem}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              await onAdd({ date, mealType, guests, perPlate, items })
            }}
            loading={saving}
            disabled={!date || !mealType || !guests || items.length === 0}
          >
            <Plus className="w-4 h-4 mr-1" />Add Meal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
