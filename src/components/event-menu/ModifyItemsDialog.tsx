"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Badge } from "@/components/shared"
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
  /** Returns the EventItem id for an item already on the meal, so it can be removed. */
  eventItemIdFor: (itemId: string) => string | undefined
  onAdd: (itemId: string) => void
  onRemove: (eventItemId: string) => void
  busy: boolean
}

export function ModifyItemsDialog({
  open, onOpenChange, mealLabel, mealDate, defaultMealLabel,
  categories, loadingCategories, selectedItemIds, eventItemIdFor,
  onAdd, onRemove, busy,
}: ModifyItemsDialogProps) {
  const [search, setSearch] = useState("")

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) setSearch("")
  }

  const handleToggle = (item: PickerItem) => {
    const eventItemId = eventItemIdFor(item.id)
    if (selectedItemIds.includes(item.id) && eventItemId) onRemove(eventItemId)
    else onAdd(item.id)
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

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            className="input pl-10 w-full"
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <CategoryItemPicker
          className="space-y-3 max-h-[400px] overflow-y-auto mt-2"
          categories={categories}
          loading={loadingCategories}
          search={search}
          disabled={busy}
          isSelected={item => selectedItemIds.includes(item.id)}
          onToggleItem={handleToggle}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
