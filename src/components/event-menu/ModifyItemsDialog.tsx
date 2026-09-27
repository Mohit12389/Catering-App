"use client"

import { useEffect, useState } from "react"  // CHANGED: + useEffect (reset pending changes on open)
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Badge, SearchInput } from "@/components/shared"  // CHANGED: + SearchInput (icons no longer imported here)
import { formatDate } from "@/lib/utils"
import { CategoryItemPicker, type PickerCategory, type PickerItem } from "./CategoryItemPicker"

// CHANGED: lifted out of event-menu/[eventId]/page.tsx. Owns its own search box —
// nothing outside it read that. The category list comes from the shared picker.

interface ModifyItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The meal being edited: its label, date, and the items already on it. */
  mealLabel?: string | null
  mealDate?: string | Date | null
  /** Shown when the meal has no label of its own. */
  defaultMealLabel?: string | null
  categories: PickerCategory[]
  loadingCategories: boolean
  selectedItemIds: string[]
  // CHANGED: ticks/unticks stay on screen and are saved together in ONE request when
  // the dialog closes (like Add Meal), instead of a save + full reload on every click.
  /** Item ids to add / remove. Resolves true when saved, so the dialog can close. */
  onSave: (changes: { add: string[]; remove: string[] }) => Promise<boolean>
  saving: boolean
}

export function ModifyItemsDialog({
  open, onOpenChange, mealLabel, mealDate, defaultMealLabel,
  categories, loadingCategories, selectedItemIds,
  onSave, saving,
}: ModifyItemsDialogProps) {
  const [search, setSearch] = useState("")
  // CHANGED: pending changes, not yet saved
  const [toAdd, setToAdd] = useState<string[]>([])
  const [toRemove, setToRemove] = useState<string[]>([])
  const changeCount = toAdd.length + toRemove.length

  useEffect(() => {
    if (open) { setToAdd([]); setToRemove([]) }
  }, [open])

  const close = () => {
    onOpenChange(false)
    setSearch("")
  }

  // CHANGED: closing in ANY way (Done, ✕, Esc, clicking outside) saves the pending
  // changes — before, every click was saved instantly, so nothing was ever lost on
  // close; this keeps that promise. "Discard changes" is the only way to throw them away.
  const handleOpenChange = async (next: boolean) => {
    if (next) { onOpenChange(true); return }
    if (saving) return
    if (changeCount === 0) { close(); return }
    const ok = await onSave({ add: toAdd, remove: toRemove })
    if (ok) close()  // on failure stay open with the ticks intact, so nothing is lost
  }

  const isSelected = (itemId: string) =>
    toAdd.includes(itemId) || (selectedItemIds.includes(itemId) && !toRemove.includes(itemId))

  const handleToggle = (item: PickerItem) => {
    const id = item.id
    if (toAdd.includes(id)) setToAdd(prev => prev.filter(x => x !== id))
    else if (toRemove.includes(id)) setToRemove(prev => prev.filter(x => x !== id))
    else if (selectedItemIds.includes(id)) setToRemove(prev => [...prev, id])
    else setToAdd(prev => [...prev, id])
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modify Menu Items
            {mealLabel && (
              <Badge variant="secondary" className="capitalize">
                {mealLabel === "default" ? defaultMealLabel : mealLabel}
              </Badge>
            )}
            {mealDate && (
              <span className="text-sm text-muted-foreground font-normal">
                ({formatDate(mealDate)})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* CHANGED: shared SearchInput instead of a local copy */}
        <SearchInput
          wrapperClassName="mt-2"
          placeholder="Search items..."
          value={search}
          onChange={setSearch}
          autoFocus
        />

        <CategoryItemPicker
          className="space-y-3 max-h-[400px] overflow-y-auto mt-2"
          categories={categories}
          loading={loadingCategories}
          search={search}
          disabled={saving}
          isSelected={item => isSelected(item.id)}
          onToggleItem={handleToggle}
        />

        <DialogFooter>
          {/* CHANGED: Done saves all pending changes at once; Discard throws them away */}
          {changeCount > 0 && (
            <Button variant="ghost" disabled={saving} onClick={close}>Discard changes</Button>
          )}
          <Button variant={changeCount > 0 ? "primary" : "outline"} loading={saving} onClick={() => handleOpenChange(false)}>
            {changeCount > 0 ? `Done (${changeCount} change${changeCount > 1 ? "s" : ""})` : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
