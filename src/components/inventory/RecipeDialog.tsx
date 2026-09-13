"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { ChefHat, Copy, Package, Plus, Save, Search, X } from "lucide-react"
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui"
import { Badge, CategoryDropdown } from "@/components/shared"

// =============================================
// RECIPE DIALOG
// =============================================
// CHANGED: lifted out of customize-inventory/page.tsx, which was ~180 lines of this
// dialog inline. The search boxes, their dropdowns, the outside-click handler and the
// expanded-category list are all state that ONLY this dialog uses, so they moved in
// here rather than being passed as a dozen props. The page keeps what it genuinely
// owns: which item is being edited, which ingredients are selected, and the handlers
// that talk to the server.

interface CopyableItem {
  id: string
  name: string
  categoryName?: string
  itemIngredients?: { id: string }[]
}

interface FlatIngredient {
  id: string
  name: string
  unit: string
  categoryName: string
}

// Generic over the caller's item type so the page can pass its own richer Item
// without this component having to know about categoryId, userId and the rest.
interface RecipeDialogProps<T extends CopyableItem> {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: { id: string; name: string } | null
  /** Categories with their ingredients, for the browse-by-category list. */
  ingredientCategories: { id: string; name: string; ingredients?: { id: string; name: string; unit: string }[] }[]
  /** Every ingredient, flattened, with its category name — used by the search box. */
  allIngredients: FlatIngredient[]
  /** Other items that already have a recipe, to copy from. */
  copyableItems: T[]
  selectedIngredientIds: string[]
  onToggleIngredient: (ingredientId: string) => void
  onCopyRecipe: (source: T) => void
  copying: boolean
  onSave: () => void
  saving: boolean
}

export function RecipeDialog<T extends CopyableItem>({
  open, onOpenChange, item, ingredientCategories, allIngredients, copyableItems,
  selectedIngredientIds, onToggleIngredient, onCopyRecipe, copying, onSave, saving,
}: RecipeDialogProps<T>) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [copySearch, setCopySearch] = useState("")
  const [showCopyDropdown, setShowCopyDropdown] = useState(false)
  const copyRef = useRef<HTMLDivElement>(null)

  const [expandedCats, setExpandedCats] = useState<string[]>([])

  // Close either dropdown when the click lands outside it.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
      if (copyRef.current && !copyRef.current.contains(event.target as Node)) {
        setShowCopyDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return allIngredients
      .filter(ing => ing.name.toLowerCase().includes(query) && !selectedIngredientIds.includes(ing.id))
      .slice(0, 8)
  }, [searchQuery, allIngredients, selectedIngredientIds])

  const selectedDetails = useMemo(
    () => allIngredients.filter(ing => selectedIngredientIds.includes(ing.id)),
    [allIngredients, selectedIngredientIds]
  )

  const filteredCopyable = useMemo(() => {
    if (!copySearch.trim()) return copyableItems.slice(0, 10)
    const query = copySearch.toLowerCase()
    return copyableItems.filter(i => i.name.toLowerCase().includes(query)).slice(0, 10)
  }, [copySearch, copyableItems])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    // Clear this dialog's own search state on close, as the page used to do for it.
    if (!next) {
      setSearchQuery("")
      setShowSearchResults(false)
      setCopySearch("")
      setShowCopyDropdown(false)
      setExpandedCats([])
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            Recipe for: {item?.name}
          </DialogTitle>
        </DialogHeader>

        {/* Copy an existing recipe — caterers reuse menus, so this is the common path */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg" ref={copyRef}>
          <div className="flex items-center gap-2 mb-2">
            <Copy className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-800">
              Copy Recipe from Another Item / दूसरे आइटम से रेसिपी कॉपी करें
            </p>
          </div>
          <p className="text-xs text-blue-600 mb-2">
            Select an item below to copy its ingredients into this recipe. Existing ingredients will be kept.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              className="input pl-9 w-full text-sm"
              placeholder="Search items to copy recipe from..."
              value={copySearch}
              onChange={e => { setCopySearch(e.target.value); setShowCopyDropdown(true) }}
              onFocus={() => setShowCopyDropdown(true)}
            />
            {copySearch && (
              <button
                type="button"
                onClick={() => { setCopySearch(""); setShowCopyDropdown(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showCopyDropdown && (
            <div className="mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filteredCopyable.length > 0 ? (
                filteredCopyable.map(source => (
                  <button
                    key={source.id}
                    type="button"
                    disabled={copying}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between border-b last:border-b-0 text-sm disabled:opacity-50"
                    onClick={() => {
                      onCopyRecipe(source)
                      setCopySearch("")
                      setShowCopyDropdown(false)
                    }}
                  >
                    <div>
                      <span className="font-medium">{source.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        • {source.categoryName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="success" className="text-xs">
                        {source.itemIngredients?.length || 0} ingredients
                      </Badge>
                      <Copy className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-center text-muted-foreground text-xs">
                  {copySearch
                    ? `No items with recipes found for "${copySearch}"`
                    : "Type to search items with existing recipes..."}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-2">
          Or search / browse to add ingredients manually / सामग्री खोजें या ब्राउज़ करें
        </p>

        {/* Search Bar with Autocomplete */}
        <div className="relative mt-2" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Search ingredients... (e.g., 'pan' for paneer)"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true) }}
              onFocus={() => setShowSearchResults(true)}
            />
          </div>

          {showSearchResults && searchQuery && filteredIngredients.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredIngredients.map(ing => (
                <button
                  key={ing.id}
                  type="button"
                  className="w-full px-4 py-2.5 text-left hover:bg-primary/10 flex items-center justify-between border-b last:border-b-0"
                  onClick={() => { onToggleIngredient(ing.id); setSearchQuery(""); setShowSearchResults(false) }}
                >
                  <div>
                    <span className="font-medium">{ing.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({ing.unit})</span>
                    <span className="text-xs text-primary ml-2">• {ing.categoryName}</span>
                  </div>
                  <Plus className="w-4 h-4 text-primary" />
                </button>
              ))}
            </div>
          )}

          {showSearchResults && searchQuery && filteredIngredients.length === 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-3 text-center text-muted-foreground text-sm">
              No ingredients found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Selected Ingredients */}
        {selectedDetails.length > 0 && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Selected Ingredients ({selectedDetails.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedDetails.map(ing => (
                <div key={ing.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-primary/30 rounded-full text-sm">
                  <span>{ing.name}</span>
                  <span className="text-xs text-muted-foreground">({ing.unit})</span>
                  <button
                    type="button"
                    onClick={() => onToggleIngredient(ing.id)}
                    className="w-5 h-5 rounded-full bg-destructive/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Browse by Category */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Browse by Category / श्रेणी से ब्राउज़ करें</p>
          <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-2">
            {ingredientCategories.map(cat => (
              <CategoryDropdown
                key={cat.id}
                category={{ id: cat.id, name: cat.name, items: cat.ingredients?.map(i => ({ id: i.id, name: i.name, unit: i.unit })) || [] }}
                expanded={expandedCats.includes(cat.id)}
                onToggle={() => setExpandedCats(prev =>
                  prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                )}
                onSelectItem={(selected) => onToggleIngredient(selected.id)}
                selectedItemIds={selectedIngredientIds}
                itemLabelSuffix={(selected) => `(${selected.unit})`}
                allowDeselect
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} loading={saving}>
            <Save className="w-4 h-4 mr-2" />Save Recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
