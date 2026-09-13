"use client"

import { Pencil, Save } from "lucide-react"
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"

// CHANGED: lifted verbatim out of customize-inventory/page.tsx. Presentational only —
// the page still owns the state and the save handler, so behaviour is unchanged.

interface EditItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (value: string) => void
  categoryId: string
  onCategoryChange: (value: string) => void
  categories: { id: string; name: string }[]
  onSave: () => void
  saving: boolean
}

export function EditItemDialog({
  open, onOpenChange, name, onNameChange,
  categoryId, onCategoryChange, categories, onSave, saving,
}: EditItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Item / आइटम संपादित करें
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="label mb-1.5 block">Item Name / आइटम का नाम</label>
            <Input
              placeholder="Item name"
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
