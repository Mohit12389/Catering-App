"use client"

import { useState } from "react"
import { ChevronDown, Plus, Check, Trash2, IndianRupee, X, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

interface CategoryItem {
  id: string
  name: string
  unit?: string
  ratePerUnit?: number | null
  categoryId?: string
}

interface Category {
  id: string
  name: string
  items: CategoryItem[]
}

interface CategoryDropdownProps {
  category: Category
  expanded?: boolean
  onToggle?: () => void
  onSelectItem?: (item: CategoryItem) => void
  onDeleteItem?: (itemId: string) => void
  onEditItem?: (item: CategoryItem) => void
  onDeleteCategory?: () => void
  selectedItemIds?: string[]
  showDelete?: boolean
  showEdit?: boolean
  showPrice?: boolean
  allowDeselect?: boolean
  itemLabelSuffix?: (item: CategoryItem) => string
}

export function CategoryDropdown({
  category,
  expanded = false,
  onToggle,
  onSelectItem,
  onDeleteItem,
  onEditItem,
  onDeleteCategory,
  selectedItemIds = [],
  showDelete = false,
  showEdit = false,
  showPrice = false,
  allowDeselect = false,
  itemLabelSuffix,
}: CategoryDropdownProps) {
  return (
    <div className="border rounded-lg overflow-hidden animate-in">
      {/* Category Header */}
      <div className="category-header" onClick={onToggle}>
        <div className="flex items-center gap-2">
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
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{item.name}</span>
                    {itemLabelSuffix && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {itemLabelSuffix(item)}
                      </span>
                    )}
                    {showPrice && item.ratePerUnit !== undefined && item.ratePerUnit !== null && (
                      <span className="text-xs text-amber-600 ml-2 inline-flex items-center">
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