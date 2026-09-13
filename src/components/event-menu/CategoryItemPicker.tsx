"use client"

import { useState } from "react"
import { ChevronDown, Plus, X } from "lucide-react"
import { Loading } from "@/components/shared"
import { cn } from "@/lib/utils"

// =============================================
// CATEGORY → ITEM PICKER
// =============================================
// CHANGED: both dialogs in event-menu/[eventId]/page.tsx rendered their own copy of
// this accordion-of-categories-with-an-item-grid. Same markup, same expand state, same
// select/deselect button — written twice. It is one component now.
//
// The expanded-category state lives here because nothing outside the pickers read it.

export interface PickerItem {
  id: string
  name: string
}

export interface PickerCategory {
  id: string
  name: string
  items?: PickerItem[]
}

interface CategoryItemPickerProps {
  categories: PickerCategory[]
  loading?: boolean
  isSelected: (item: PickerItem) => boolean
  onToggleItem: (item: PickerItem) => void
  disabled?: boolean
  /**
   * When non-empty, categories auto-expand and their items are filtered. A category
   * whose OWN name matches shows all of its items, which is what the search in the
   * modify dialog did.
   */
  search?: string
  /** The add-meal dialog renders a tighter grid than the modify dialog. */
  compact?: boolean
  className?: string
}

export function CategoryItemPicker({
  categories, loading, isSelected, onToggleItem,
  disabled, search = "", compact, className,
}: CategoryItemPickerProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const query = search.trim().toLowerCase()

  const toggleCategory = (id: string) =>
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  if (loading) return <Loading className={compact ? "min-h-[100px]" : "min-h-[200px]"} />

  return (
    <div className={className}>
      {categories.map(cat => {
        const all = cat.items || []
        const matches = query ? all.filter(i => i.name.toLowerCase().includes(query)) : all
        const categoryMatches = query ? cat.name.toLowerCase().includes(query) : false
        if (query && !categoryMatches && matches.length === 0) return null

        const itemsToShow = categoryMatches ? all : matches
        const expanded = expandedIds.includes(cat.id) || Boolean(query)

        return (
          <div key={cat.id} className="border rounded-lg overflow-hidden">
            <div className="category-header" onClick={() => toggleCategory(cat.id)}>
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
                <span className="font-medium">{cat.name}</span>
                <span className="badge-primary">{itemsToShow.length}</span>
              </div>
            </div>
            {expanded && (
              <div className="p-2 grid grid-cols-2 gap-2">
                {itemsToShow.map(item => {
                  const selected = isSelected(item)
                  return (
                    <button
                      type="button"
                      key={item.id}
                      disabled={disabled}
                      className={cn(
                        "rounded-lg border text-left transition-all",
                        compact ? "p-2.5 text-sm" : "p-3",
                        selected ? "bg-primary/10 border-primary/30" : "hover:bg-muted hover:border-primary/50"
                      )}
                      onClick={() => onToggleItem(item)}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("font-medium", !compact && "text-sm")}>{item.name}</span>
                        {selected
                          ? <X className="w-4 h-4 text-destructive" />
                          : <Plus className="w-4 h-4 text-primary" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
