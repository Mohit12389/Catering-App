"use client"

import { Pencil, Save } from "lucide-react"
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"
import { UNITS } from "@/lib/units"

// CHANGED: lifted verbatim out of customize-inventory/page.tsx. Presentational only.
// CHANGED: master price is now editable here too. The server applies the same rule as
// Update Prices (existing events keep the old price), via lib/masterPrice.ts.
// Date-range price changes still live only in the Update Prices section.

interface EditIngredientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (value: string) => void
  categoryId: string
  onCategoryChange: (value: string) => void
  unit: string
  onUnitChange: (value: string) => void
  price: string                          // CHANGED: master price, as typed
  onPriceChange: (value: string) => void // CHANGED
  originalUnit: string                   // CHANGED: to warn when the unit changes
  categories: { id: string; name: string }[]
  onSave: () => void
  saving: boolean
}

export function EditIngredientDialog({
  open, onOpenChange, name, onNameChange, categoryId, onCategoryChange,
  unit, onUnitChange, price, onPriceChange, originalUnit, categories, onSave, saving, // CHANGED: price props
}: EditIngredientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Ingredient / सामग्री संपादित करें
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="label mb-1.5 block">Ingredient Name / सामग्री का नाम</label>
            <Input
              placeholder="Ingredient name"
              value={name}
              onChange={e => onNameChange(e.target.value)}
            />
          </div>
          <div>
            <label className="label mb-1.5 block">Category / श्रेणी</label>
            <Select value={categoryId} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="label mb-1.5 block">Unit Type / इकाई प्रकार</label>
            <Select value={unit} onValueChange={onUnitChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map(u => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* CHANGED: unit change warning — quantities and old prices are per the OLD unit */}
          {unit !== originalUnit && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Unit changed: quantities already entered in events are not converted, and past events keep their old per-unit price.
              / इकाई बदलने पर पुराने इवेंट की मात्रा और मूल्य नहीं बदलेंगे।
            </p>
          )}
          {/* CHANGED: 4th field — new master price */}
          <div>
            <label className="label mb-1.5 block">Price / मूल्य (₹ per {unit || "unit"})</label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={price}
              onChange={e => onPriceChange(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            New price applies to new events only — existing events keep their old price.
            For a date-range price change, use the &quot;Update Prices&quot; section.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} loading={saving} disabled={!name.trim() || price.trim() === ""}>
            <Save className="w-4 h-4 mr-2" />Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
