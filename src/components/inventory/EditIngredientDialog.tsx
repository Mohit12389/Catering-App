"use client"

import { Pencil, Save } from "lucide-react"
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"
import { UNITS } from "@/lib/units"

// CHANGED: lifted verbatim out of customize-inventory/page.tsx. Presentational only.
// Price is deliberately NOT editable here — that is the Update Prices section's job,
// because changing a master rate has to decide what happens to existing events.

interface EditIngredientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (value: string) => void
  categoryId: string
  onCategoryChange: (value: string) => void
  unit: string
  onUnitChange: (value: string) => void
  categories: { id: string; name: string }[]
  onSave: () => void
  saving: boolean
}

export function EditIngredientDialog({
  open, onOpenChange, name, onNameChange, categoryId, onCategoryChange,
  unit, onUnitChange, categories, onSave, saving,
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
          <p className="text-xs text-muted-foreground">
            Note: Price is not editable here. Use the &quot;Update Prices&quot; section for price changes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} loading={saving} disabled={!name.trim()}>
            <Save className="w-4 h-4 mr-2" />Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
