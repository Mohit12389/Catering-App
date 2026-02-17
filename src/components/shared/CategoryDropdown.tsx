"use client"

import { useState, useCallback, useRef } from "react"
import { ChevronDown, Plus, Check, Trash2, IndianRupee, X, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

interface CategoryItem {
  id: string
  name: string
  unit?: string
  ratePerUnit?: number | null
  categoryId?: string
  sortOrder?: number
}

interface Category {
  id: string
  name: string
  items: CategoryItem[]
  sortOrder?: number
}

interface CategoryDropdownProps {
  category: Category
  expanded?: boolean
  onToggle?: () => void
  onSelectItem?: (item: CategoryItem) => void
  onDeleteItem?: (itemId: string) => void
  onEditItem?: (item: CategoryItem) => void
  onDeleteCategory?: () => void
  onSortOrderChange?: (type: "category" | "item", id: string, newOrder: number) => void
  selectedItemIds?: string[]
  showDelete?: boolean
  showEdit?: boolean
  showPrice?: boolean
  showSortOrder?: boolean
  sortOrderType?: "itemCategory" | "ingredientCategory" | "ingredient"
  allowDeselect?: boolean
  itemLabelSuffix?: (item: CategoryItem) => string
}

function SortOrderInput({ 
  value, 
  onSave 
}: { 
  value: number
  onSave: (newValue: number) => void 
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(value || ""))
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSave = useCallback(() => {
    const parsed = parseInt(inputValue)
    if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
      onSave(parsed)
    }
    setEditing(false)
  }, [inputValue, value, onSave])

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setInputValue(String(value || ""))
          setEditing(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={cn(
          "w-8 h-6 text-xs font-mono rounded border text-center transition-colors shrink-0",
          value > 0
            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
            : "bg-muted/50 border-gray-200 text-muted-foreground"
        )}
        title="Click to set priority / प्राथमिकता सेट करें"
      >
        {value > 0 ? value : "–"}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min={0}
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={e => {
        if (e.key === "Enter") handleSave()
        if (e.key === "Escape") setEditing(false)
      }}
      onClick={e => e.stopPropagation()}
      className="w-10 h-6 text-xs font-mono rounded border border-primary text-center focus:outline-none focus:ring-1 focus:ring-primary bg-white shrink-0"
    />
  )
}

export function CategoryDropdown({
  category,
  expanded = false,
  onToggle,
  onSelectItem,
  onDeleteItem,
  onEditItem,
  onDeleteCategory,
  onSortOrderChange,
  selectedItemIds = [],
  showDelete = false,
  showEdit = false,
  showPrice = false,
  showSortOrder = false,
  sortOrderType,
  allowDeselect = false,
  itemLabelSuffix,
}: CategoryDropdownProps) {
  return (
    <div className="border rounded-lg overflow-hidden animate-in">
      {/* Category Header */}
      <div className="category-header" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {showSortOrder && onSortOrderChange && (
            <SortOrderInput
              value={category.sortOrder || 0}
              onSave={(newOrder) => onSortOrderChange("category", category.id, newOrder)}
            />
          )}
          <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
          <span className="font-medium">{category.name}</span>
          <span className="badge-primary">{category.items?.length || 0}</span>
        </div>
        {showDelete && onDeleteCategory && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteCategory()
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Category Content */}
      {expanded && (
        <div className="category-content">
          {category.items && category.items.length > 0 ? (
            category.items.map((item) => {
              const isSelected = selectedItemIds.includes(item.id)
              const canClick = onSelectItem && (!isSelected || allowDeselect)
              return (
                <div
                  key={item.id}
                  className={cn(
                    "category-item",
                    isSelected && "category-item-selected",
                    canClick && "cursor-pointer"
                  )}
                  onClick={() => canClick && onSelectItem?.(item)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Item-level sort order (only for ingredients) */}
                    {showSortOrder && sortOrderType === "ingredient" && onSortOrderChange && (
                      <SortOrderInput
                        value={item.sortOrder || 0}
                        onSave={(newOrder) => onSortOrderChange("item", item.id, newOrder)}
                      />
                    )}
                    <span className="text-sm font-medium">{item.name}</span>
                    {itemLabelSuffix && (
                      <span className="text-xs text-muted-foreground">
                        {itemLabelSuffix(item)}
                      </span>
                    )}
                    {showPrice && item.ratePerUnit !== undefined && item.ratePerUnit !== null && (
                      <span className="text-xs text-amber-600 inline-flex items-center">
                        <IndianRupee className="w-3 h-3" />
                        {item.ratePerUnit}/{item.unit}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isSelected ? (
                      allowDeselect ? (
                        <X className="w-4 h-4 text-destructive" />
                      ) : (
                        <Check className="w-4 h-4 text-primary" />
                      )
                    ) : onSelectItem ? (
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    ) : null}
                    {showEdit && onEditItem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditItem(item)
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                    {showDelete && onDeleteItem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteItem(item.id)
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items in this category / इस श्रेणी में कोई आइटम नहीं
            </p>
          )}
        </div>
      )}
    </div>
  )
}