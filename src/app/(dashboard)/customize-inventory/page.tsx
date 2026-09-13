"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { 
  ChefHat, 
  Package, 
  Link2, 
  Plus, 
  Languages,
  Save,
  IndianRupee,
  Calendar,
  Search,
  X
} from "lucide-react"
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, CategoryDropdown, EmptyState, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/apiClient"  // CHANGED: normalises fetch + error handling
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { ItemCategory, IngredientCategory, Item, Ingredient } from "@/types"
import { useConfirm } from "@/components/shared"
import { EditItemDialog, EditIngredientDialog, RecipeDialog } from "@/components/inventory" // CHANGED: extracted dialogs
import { UNITS } from "@/lib/units" // CHANGED: shared with the extracted ingredient dialog


export default function CustomizeInventoryPage() {
  const { toast } = useToast()

  const confirm = useConfirm()
  
  // Use SWR for cached data fetching
  const { 
    data: itemCategories = [], 
    isLoading: loadingItems, 
    mutate: mutateItems 
  } = useSWRFetch<ItemCategory[]>('/api/categories/items')
  
  const { 
    data: ingredientCategories = [], 
    isLoading: loadingIngredients, 
    mutate: mutateIngredients 
  } = useSWRFetch<IngredientCategory[]>('/api/categories/ingredients')
  
  // Expanded categories
  const [expandedItemCats, setExpandedItemCats] = useState<string[]>([])
  const [expandedIngCats, setExpandedIngCats] = useState<string[]>([])
  
  // New category inputs
  const [newItemCatName, setNewItemCatName] = useState("")
  const [newIngCatName, setNewIngCatName] = useState("")
  const [addingItemCat, setAddingItemCat] = useState(false)
  const [addingIngCat, setAddingIngCat] = useState(false)
  
  // Dialog states
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [ingDialogOpen, setIngDialogOpen] = useState(false)
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false)
  
  // New item form
  const [newItemName, setNewItemName] = useState("")
  const [newItemCatId, setNewItemCatId] = useState("")
  const [addingItem, setAddingItem] = useState(false)
  
  // New ingredient form
  const [newIngName, setNewIngName] = useState("")
  const [newIngUnit, setNewIngUnit] = useState("Kg")
  const [newIngPrice, setNewIngPrice] = useState("")
  const [newIngCatId, setNewIngCatId] = useState("")
  const [addingIng, setAddingIng] = useState(false)
  
  // ==========================================
  // EDIT ITEM STATE (Feature 1)
  // ==========================================
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState("")
  const [editItemName, setEditItemName] = useState("")
  const [editItemCatId, setEditItemCatId] = useState("")
  const [savingItemEdit, setSavingItemEdit] = useState(false)

  // ==========================================
  // EDIT INGREDIENT STATE (Feature 2)
  // ==========================================
  const [editIngDialogOpen, setEditIngDialogOpen] = useState(false)
  const [editingIngId, setEditingIngId] = useState("")
  const [editIngName, setEditIngName] = useState("")
  const [editIngCatId, setEditIngCatId] = useState("")
  const [editIngUnit, setEditIngUnit] = useState("")
  const [savingIngEdit, setSavingIngEdit] = useState(false)

  // ==========================================
  // COPY RECIPE STATE (Feature 3)
  // ==========================================
  const [copyingRecipe, setCopyingRecipe] = useState(false)

  // Recipe builder
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([])
  const [savingRecipe, setSavingRecipe] = useState(false)
  
  // Recipe search
  
  // Search bars for 3 sections
  const [menuItemSearch, setMenuItemSearch] = useState("")
  const [ingredientSearch, setIngredientSearch] = useState("")
  const [recipeBuilderSearch, setRecipeBuilderSearch] = useState("")
  
  // Bulk price update (4th box)
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null)
  const [newPrice, setNewPrice] = useState("")
  const [priceStartDate, setPriceStartDate] = useState("")
  const [priceEndDate, setPriceEndDate] = useState("")
  const [updatingPrice, setUpdatingPrice] = useState(false)
  const [priceIngredientSearch, setPriceIngredientSearch] = useState("")
  const [showPriceIngredientResults, setShowPriceIngredientResults] = useState(false)

  // CHANGED: the outside-click handler moved into RecipeDialog with the two
  // dropdowns it closed — they were its only subjects.

  // Get all ingredients flat for bulk update
  const allIngredients = useMemo(() => 
    ingredientCategories.flatMap(cat => cat.ingredients || []),
    [ingredientCategories]
  )

  // Get all ingredients flat with category name for recipe search
  const allIngredientsFlat = useMemo(() => 
    ingredientCategories.flatMap(cat => 
      (cat.ingredients || []).map(ing => ({ ...ing, categoryName: cat.name }))
    ),
    [ingredientCategories]
  )

  // Filter item categories based on search
  const filteredItemCategories = useMemo(() => {
    if (!menuItemSearch.trim()) return itemCategories
    const query = menuItemSearch.toLowerCase()
    return itemCategories
      .map(cat => ({
        ...cat,
        items: (cat.items || []).filter(item => 
          item.name.toLowerCase().includes(query)
        )
      }))
      .filter(cat => 
        cat.name.toLowerCase().includes(query) || cat.items.length > 0
      )
  }, [menuItemSearch, itemCategories])

  // Filter ingredient categories based on search
  const filteredIngredientCategories = useMemo(() => {
    if (!ingredientSearch.trim()) return ingredientCategories
    const query = ingredientSearch.toLowerCase()
    return ingredientCategories
      .map(cat => ({
        ...cat,
        ingredients: (cat.ingredients || []).filter(ing => 
          ing.name.toLowerCase().includes(query)
        )
      }))
      .filter(cat => 
        cat.name.toLowerCase().includes(query) || (cat.ingredients?.length || 0) > 0
      )
  }, [ingredientSearch, ingredientCategories])

  // Get all items flat
  const allItems = useMemo(() => 
    itemCategories.flatMap(cat => (cat.items || []).map(item => ({ ...item, categoryName: cat.name }))),
    [itemCategories]
  )

  // Filter items for recipe builder
  const filteredRecipeBuilderItems = useMemo(() => {
    if (!recipeBuilderSearch.trim()) return allItems
    const query = recipeBuilderSearch.toLowerCase()
    return allItems.filter(item => item.name.toLowerCase().includes(query))
  }, [recipeBuilderSearch, allItems])

  // ==========================================
  // Items that can be copied from (for Feature 3)
  // Only show items that have a recipe AND are not the current item
  // ==========================================
  const copyableItems = useMemo(() => {
    if (!selectedItem) return []
    return allItems.filter(item => 
      item.id !== selectedItem.id && 
      (item.itemIngredients?.length || 0) > 0
    )
  }, [allItems, selectedItem])

  // Filter ingredients for price update search
  const filteredPriceIngredients = useMemo(() => {
    if (!priceIngredientSearch.trim()) return allIngredients.slice(0, 10)
    const query = priceIngredientSearch.toLowerCase()
    return allIngredients
      .filter(ing => ing.name.toLowerCase().includes(query))
      .slice(0, 10)
  }, [priceIngredientSearch, allIngredients])

  // ==========================================
  // HANDLERS: Add Categories
  // ==========================================

  const handleAddItemCategory = useCallback(async () => {
    if (!newItemCatName.trim()) return
    setAddingItemCat(true)
    
    // CHANGED: this used to show "Success" and add the row to the screen BEFORE
    // calling the server, then never look at the reply. fetch() does not throw on
    // a 400, so a rejected duplicate still reported success and the row silently
    // vanished on the next refresh. Now it waits for the server, like the
    // ingredient-category handler next to it already did.
    const name = newItemCatName.trim()
    try {
      await api.post("/api/categories/items", { name })
      mutateItems()
      setNewItemCatName("")
      toast({ title: "Success", description: "Category added" })
    } catch (error: any) {
      mutateItems()
      toast({ title: "Error", description: error.message || "Failed to add category", variant: "destructive" })
    } finally {
      setAddingItemCat(false)
    }
  }, [newItemCatName, mutateItems, toast])

  const handleAddIngCategory = useCallback(async () => {
    if (!newIngCatName.trim()) return
    setAddingIngCat(true)
    try {
      const res = await fetch("/api/categories/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newIngCatName.trim() })
      })
      const data = await res.json()
      if (data.success) {
        mutateIngredients()
        setNewIngCatName("")
        toast({ title: "Success", description: "Category added" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingIngCat(false)
    }
  }, [newIngCatName, mutateIngredients, toast])

  // ==========================================
  // HANDLERS: Add Items / Ingredients
  // ==========================================

  const handleAddItem = useCallback(async () => {
    if (!newItemName.trim() || !newItemCatId) return
    setAddingItem(true)
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItemName.trim(), categoryId: newItemCatId })
      })
      const data = await res.json()
      if (data.success) {
        mutateItems()
        setNewItemName("")
        setNewItemCatId("")
        setItemDialogOpen(false)
        toast({ title: "Success", description: "Item added" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingItem(false)
    }
  }, [newItemName, newItemCatId, mutateItems, toast])

  const handleAddIngredient = useCallback(async () => {
    if (!newIngName.trim() || !newIngUnit || !newIngCatId) return
    setAddingIng(true)
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newIngName.trim(), 
          unit: newIngUnit, 
          categoryId: newIngCatId,
          ratePerUnit: parseFloat(newIngPrice) || 0
        })
      })
      const data = await res.json()
      if (data.success) {
        mutateIngredients()
        setNewIngName("")
        setNewIngUnit("Kg")
        setNewIngPrice("")
        setNewIngCatId("")
        setIngDialogOpen(false)
        toast({ title: "Success", description: "Ingredient added" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingIng(false)
    }
  }, [newIngName, newIngUnit, newIngPrice, newIngCatId, mutateIngredients, toast])

  // ==========================================
  // HANDLERS: Delete
  // ==========================================

  const handleDeleteItemCategory = useCallback(async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      description: "This will delete the category and all its items. This cannot be undone."
    })
    if (!ok) return
    try {
      // CHANGED: was `if (res.ok)` with NO else branch — a failed delete (404/403/500)
      // silently did nothing at all. api.del throws, so failures now surface as a toast.
      await api.del(`/api/categories/items?id=${id}`)
      mutateItems()
      toast({ title: "Success", description: "Category deleted" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" })
    }
  }, [mutateItems, toast, confirm])

  const handleDeleteIngCategory = useCallback(async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      description: "This will delete the category and all its ingredients. This cannot be undone."
    })
    if (!ok) return
    try {
      // CHANGED: was `if (res.ok)` with NO else branch — a failed delete (404/403/500)
      // silently did nothing at all. api.del throws, so failures now surface as a toast.
      await api.del(`/api/categories/ingredients?id=${id}`)
      mutateIngredients()
      toast({ title: "Success", description: "Category deleted" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" })
    }
  }, [mutateIngredients, toast, confirm])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    // CHANGED: Added confirmation (was missing before)
    const ok = await confirm({
      title: "Delete this item?",
      description: "This will permanently remove the menu item. This cannot be undone."
    })
    if (!ok) return
    try {
      // CHANGED: was `if (res.ok)` with NO else branch — a failed delete (404/403/500)
      // silently did nothing at all. api.del throws, so failures now surface as a toast.
      await api.del(`/api/items?id=${itemId}`)
      mutateItems()
      toast({ title: "Success", description: "Item deleted" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" })
    }
  }, [mutateItems, toast, confirm])

  const handleDeleteIngredient = useCallback(async (ingId: string) => {
    // CHANGED: Added confirmation (was missing before)
    const ok = await confirm({
      title: "Delete this ingredient?",
      description: "This will permanently remove the ingredient. This cannot be undone."
    })
    if (!ok) return
    try {
      // CHANGED: was `if (res.ok)` with NO else branch — a failed delete (404/403/500)
      // silently did nothing at all. api.del throws, so failures now surface as a toast.
      await api.del(`/api/ingredients?id=${ingId}`)
      mutateIngredients()
      toast({ title: "Success", description: "Ingredient deleted" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" })
    }
  }, [mutateIngredients, toast, confirm])

  // ==========================================
  // FEATURE 1: Edit Item Handler
  // ==========================================

  const openEditItemDialog = useCallback((item: { id: string; name: string; categoryId?: string }) => {
    setEditingItemId(item.id)
    setEditItemName(item.name)
    // Find the item's current category
    const parentCat = itemCategories.find(cat => 
      cat.items?.some(i => i.id === item.id)
    )
    setEditItemCatId(item.categoryId || parentCat?.id || "")
    setEditItemDialogOpen(true)
  }, [itemCategories])

  const handleEditItem = useCallback(async () => {
    if (!editingItemId || !editItemName.trim()) return
    setSavingItemEdit(true)
    try {
      const res = await fetch("/api/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItemId,
          name: editItemName.trim(),
          categoryId: editItemCatId
        })
      })
      const data = await res.json()
      if (data.success) {
        mutateItems()
        setEditItemDialogOpen(false)
        toast({ title: "Success", description: "Item updated / आइटम अपडेट हुआ" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSavingItemEdit(false)
    }
  }, [editingItemId, editItemName, editItemCatId, mutateItems, toast])

  // ==========================================
  // FEATURE 2: Edit Ingredient Handler
  // ==========================================

  const openEditIngDialog = useCallback((item: { id: string; name: string; unit?: string; categoryId?: string }) => {
    setEditingIngId(item.id)
    setEditIngName(item.name)
    setEditIngUnit(item.unit || "Kg")
    // Find the ingredient's current category
    const parentCat = ingredientCategories.find(cat => 
      cat.ingredients?.some(i => i.id === item.id)
    )
    setEditIngCatId(item.categoryId || parentCat?.id || "")
    setEditIngDialogOpen(true)
  }, [ingredientCategories])

  const handleEditIngredient = useCallback(async () => {
    if (!editingIngId || !editIngName.trim()) return
    setSavingIngEdit(true)
    try {
      const res = await fetch("/api/ingredients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingIngId,
          name: editIngName.trim(),
          categoryId: editIngCatId,
          unit: editIngUnit
        })
      })
      const data = await res.json()
      if (data.success) {
        mutateIngredients()
        setEditIngDialogOpen(false)
        toast({ title: "Success", description: "Ingredient updated / सामग्री अपडेट हुई" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSavingIngEdit(false)
    }
  }, [editingIngId, editIngName, editIngCatId, editIngUnit, mutateIngredients, toast])

  // ==========================================
  // SORT ORDER HANDLER
  // ==========================================

  const handleSortOrderChange = useCallback(async (
    type: "category" | "item",
    id: string,
    newOrder: number,
    sortOrderType: "itemCategory" | "ingredientCategory" | "ingredient"
  ) => {
    // Determine the API type parameter
    let apiType: string
    if (type === "category") {
      apiType = sortOrderType === "ingredient" ? "ingredientCategory" : sortOrderType
    } else {
      // type === "item" — this is always "ingredient" (items don't have per-item sort)
      apiType = "ingredient"
    }

    try {
      const res = await fetch("/api/sort-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: apiType, id, newSortOrder: newOrder })
      })
      const data = await res.json()
      if (data.success) {
        // Refresh the relevant data
        if (sortOrderType === "itemCategory") {
          mutateItems()
        } else {
          mutateIngredients()
        }
        toast({ title: "Priority Updated / प्राथमिकता अपडेट", description: `Set to #${newOrder}` })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }, [mutateItems, mutateIngredients, toast])

  // ==========================================
  // FEATURE 3: Copy Recipe Handler
  // ==========================================

  const handleCopyRecipe = useCallback(async (sourceItem: Item) => {
    setCopyingRecipe(true)
    try {
      const res = await fetch(`/api/items/${sourceItem.id}/ingredients`)
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        const copiedIds = data.data.map((ii: any) => ii.ingredientId)
        // Merge with existing (no duplicates)
        setSelectedIngredientIds(prev => {
          const merged = new Set([...prev, ...copiedIds])
          return Array.from(merged)
        })
        toast({ 
          title: "Recipe Copied / रेसिपी कॉपी हुई", 
          description: `${copiedIds.length} ingredients copied from "${sourceItem.name}"` 
        })
      } else {
        toast({ title: "Info", description: "Source item has no recipe to copy" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy recipe", variant: "destructive" })
    } finally {
      // CHANGED: the copy search box and its dropdown belong to RecipeDialog now,
      // and it clears them itself when a source item is picked.
      setCopyingRecipe(false)
    }
  }, [toast])

  // ==========================================
  // RECIPE HANDLERS
  // ==========================================

  const openRecipeDialog = useCallback(async (item: Item) => {
    setSelectedItem(item)
    try {
      const res = await fetch(`/api/items/${item.id}/ingredients`)
      const data = await res.json()
      if (data.success) {
        setSelectedIngredientIds(data.data.map((ii: any) => ii.ingredientId))
      }
    } catch (error) {
      setSelectedIngredientIds([])
    }
    // CHANGED: RecipeDialog resets its own search boxes and expanded categories when
    // it closes, so there is nothing to clear here before opening it again.
    setRecipeDialogOpen(true)
  }, [])

  const toggleIngredientForRecipe = useCallback((ingredientId: string) => {
    setSelectedIngredientIds(prev => 
      prev.includes(ingredientId)
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId]
    )
  }, [])

  const handleSaveRecipe = useCallback(async () => {
    if (!selectedItem) return
    setSavingRecipe(true)
    
    const optimisticData = itemCategories.map(cat => ({
      ...cat,
      items: cat.items?.map(item => 
        item.id === selectedItem.id 
          ? { ...item, itemIngredients: selectedIngredientIds.map(id => ({ id })) }
          : item
      )
    }))
    
    mutateItems({ success: true, data: optimisticData } as any, false)
    setRecipeDialogOpen(false)
    toast({ title: "Success", description: "Recipe saved / रेसिपी सहेजी गई" })
    
    try {
      await fetch(`/api/items/${selectedItem.id}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientIds: selectedIngredientIds })
      })
      mutateItems()
    } catch (error: any) {
      mutateItems()
      toast({ title: "Error", description: "Failed to save recipe", variant: "destructive" })
    } finally {
      setSavingRecipe(false)
    }
  }, [selectedItem, selectedIngredientIds, itemCategories, mutateItems, toast])

  // ==========================================
  // BULK PRICE UPDATE
  // ==========================================

  const handleBulkPriceUpdate = useCallback(async () => {
    if (!selectedIngredient || !newPrice) {
      toast({ title: "Error", description: "Please select ingredient and enter a price", variant: "destructive" })
      return
    }

    setUpdatingPrice(true)
    try {
      const res = await fetch("/api/ingredients/bulk-price-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: selectedIngredient.id,
          newPrice: parseFloat(newPrice),
          startDate: priceStartDate || null,
          endDate: priceEndDate || null
        })
      })
      
      const data = await res.json()
      if (data.success) {
        mutateIngredients()
        setSelectedIngredient(null)
        setNewPrice("")
        setPriceStartDate("")
        setPriceEndDate("")
        toast({ title: "Success", description: data.message || "Price updated successfully" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUpdatingPrice(false)
    }
  }, [selectedIngredient, newPrice, priceStartDate, priceEndDate, mutateIngredients, toast])

  // Auto-expand categories when searching
  useEffect(() => {
    if (menuItemSearch.trim()) {
      const matchingCatIds = filteredItemCategories.map(cat => cat.id)
      setExpandedItemCats(matchingCatIds)
    }
  }, [menuItemSearch, filteredItemCategories])

  useEffect(() => {
    if (ingredientSearch.trim()) {
      const matchingCatIds = filteredIngredientCategories.map(cat => cat.id)
      setExpandedIngCats(matchingCatIds)
    }
  }, [ingredientSearch, filteredIngredientCategories])

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div>
        <h1>Customize Inventory / इन्वेंटरी अनुकूलित करें</h1>
        <p className="text-muted-foreground mt-1">
          Manage menu items, ingredients, and recipes
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Languages className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary">Hindi supported / हिंदी समर्थित</span>
        </div>
      </div>

      {/* Two x Two Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ============================================ */}
        {/* Section 1: Menu Items (with Edit button)     */}
        {/* ============================================ */}
        <Card>
          <div className="section-header">
            <div className="section-title">
              <ChefHat className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Menu Items / मेन्यू आइटम</h2>
            </div>
            <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Item / आइटम जोड़ें</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Select value={newItemCatId} onValueChange={setNewItemCatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category / श्रेणी चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      {itemCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Item name / आइटम का नाम"
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    hint="e.g., Shahi Paneer / शाही पनीर"
                  />
                  <Button onClick={handleAddItem} loading={addingItem} className="w-full">
                    Add Item
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New category / नई श्रेणी"
              value={newItemCatName}
              onChange={e => setNewItemCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddItemCategory()}
            />
            <Button variant="outline" onClick={handleAddItemCategory} loading={addingItemCat}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Search items... / आइटम खोजें..."
              value={menuItemSearch}
              onChange={e => setMenuItemSearch(e.target.value)}
            />
            {menuItemSearch && (
              <button type="button" onClick={() => setMenuItemSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingItems ? (
            <Loading className="min-h-[200px]" />
          ) : filteredItemCategories.length === 0 ? (
            <EmptyState 
              icon={ChefHat} 
              title={menuItemSearch ? "No items found" : "No categories yet"} 
              description={menuItemSearch ? `No items match "${menuItemSearch}"` : "Add a category above"} 
            />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredItemCategories.map(cat => (
                <CategoryDropdown
                  key={cat.id}
                  category={{ id: cat.id, name: cat.name, sortOrder: cat.sortOrder || 0, items: (cat.items || []).map(i => ({ ...i, categoryId: cat.id })) }}
                  expanded={expandedItemCats.includes(cat.id)}
                  onToggle={() => setExpandedItemCats(prev => 
                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                  )}
                  onDeleteCategory={() => handleDeleteItemCategory(cat.id, cat.name)}
                  onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                  onEditItem={(item) => openEditItemDialog(item)}
                  onSortOrderChange={(type, id, newOrder) => handleSortOrderChange(type, id, newOrder, "itemCategory")}
                  showDelete
                  showEdit
                  showSortOrder
                  sortOrderType="itemCategory"
                />
              ))}
            </div>
          )}
        </Card>

        {/* ============================================ */}
        {/* Section 2: Ingredients (with Edit button)    */}
        {/* ============================================ */}
        <Card>
          <div className="section-header">
            <div className="section-title">
              <Package className="w-5 h-5 text-secondary" />
              <h2 className="text-lg font-semibold">Ingredients / सामग्री</h2>
            </div>
            <Dialog open={ingDialogOpen} onOpenChange={setIngDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-1" />Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Ingredient / सामग्री जोड़ें</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Select value={newIngCatId} onValueChange={setNewIngCatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category / श्रेणी चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredientCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Ingredient name / सामग्री का नाम"
                    value={newIngName}
                    onChange={e => setNewIngName(e.target.value)}
                    hint="e.g., Paneer / पनीर"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={newIngUnit} onValueChange={setNewIngUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(unit => (
                          <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Price per unit / मूल्य (₹)"
                      value={newIngPrice}
                      onChange={e => setNewIngPrice(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddIngredient} loading={addingIng} variant="secondary" className="w-full">
                    Add Ingredient
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New category / नई श्रेणी"
              value={newIngCatName}
              onChange={e => setNewIngCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddIngCategory()}
            />
            <Button variant="outline" onClick={handleAddIngCategory} loading={addingIngCat}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Search ingredients... / सामग्री खोजें..."
              value={ingredientSearch}
              onChange={e => setIngredientSearch(e.target.value)}
            />
            {ingredientSearch && (
              <button type="button" onClick={() => setIngredientSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingIngredients ? (
            <Loading className="min-h-[200px]" />
          ) : filteredIngredientCategories.length === 0 ? (
            <EmptyState 
              icon={Package} 
              title={ingredientSearch ? "No ingredients found" : "No categories yet"} 
              description={ingredientSearch ? `No ingredients match "${ingredientSearch}"` : "Add a category above"} 
            />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredIngredientCategories.map(cat => (
                <CategoryDropdown
                  key={cat.id}
                  category={{ 
                    id: cat.id, 
                    name: cat.name, 
                    sortOrder: cat.sortOrder || 0,
                    items: cat.ingredients?.map(i => ({ id: i.id, name: i.name, unit: i.unit, ratePerUnit: i.ratePerUnit, categoryId: cat.id, sortOrder: (i as any).sortOrder || 0 })) || [] 
                  }}
                  expanded={expandedIngCats.includes(cat.id)}
                  onToggle={() => setExpandedIngCats(prev => 
                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                  )}
                  onDeleteCategory={() => handleDeleteIngCategory(cat.id, cat.name)}
                  onDeleteItem={(ingId) => handleDeleteIngredient(ingId)}
                  onEditItem={(item) => openEditIngDialog(item)}
                  onSortOrderChange={(type, id, newOrder) => handleSortOrderChange(type, id, newOrder, "ingredient")}
                  showDelete
                  showEdit
                  showPrice
                  showSortOrder
                  sortOrderType="ingredient"
                />
              ))}
            </div>
          )}
        </Card>

        {/* ============================================ */}
        {/* Section 3: Recipe Builder                    */}
        {/* ============================================ */}
        <Card>
          <div className="section-header">
            <div className="section-title">
              <Link2 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold">Recipe Builder / रेसिपी</h2>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Link ingredients to menu items. Click an item to set its recipe.
            <br />
            <span className="text-xs">मेन्यू आइटम में सामग्री जोड़ें</span>
          </p>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Search menu items... / मेन्यू आइटम खोजें..."
              value={recipeBuilderSearch}
              onChange={e => setRecipeBuilderSearch(e.target.value)}
            />
            {recipeBuilderSearch && (
              <button type="button" onClick={() => setRecipeBuilderSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingItems ? (
            <Loading className="min-h-[200px]" />
          ) : filteredRecipeBuilderItems.length === 0 ? (
            <EmptyState 
              icon={Link2} 
              title={recipeBuilderSearch ? "No items found" : "No items yet"} 
              description={recipeBuilderSearch ? `No items match "${recipeBuilderSearch}"` : "Add menu items first"} 
            />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredRecipeBuilderItems.map(item => {
                const ingredientCount = item.itemIngredients?.length || 0
                return (
                  <div key={item.id} className="category-item cursor-pointer" onClick={() => openRecipeDialog(item)}>
                    <div>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <Badge variant={ingredientCount > 0 ? "success" : "warning"}>
                      {ingredientCount} ingredients
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ============================================ */}
        {/* Section 4: Bulk Price Update                 */}
        {/* ============================================ */}
        <Card>
          <div className="section-header">
            <div className="section-title">
              <IndianRupee className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Update Prices / मूल्य अपडेट</h2>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Update ingredient prices for active events in a date range.
            <br />
            <span className="text-xs">सक्रिय इवेंट के लिए सामग्री के मूल्य अपडेट करें</span>
          </p>

          <div className="space-y-4">
            <div>
              <label className="label mb-1.5 block">Select Ingredient / सामग्री चुनें *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <input
                  type="text"
                  className="input pl-10 w-full"
                  placeholder="Search ingredient... / सामग्री खोजें..."
                  value={selectedIngredient ? `${selectedIngredient.name} (${selectedIngredient.unit}) - ₹${selectedIngredient.ratePerUnit || 0}` : priceIngredientSearch}
                  onChange={e => {
                    setPriceIngredientSearch(e.target.value)
                    setShowPriceIngredientResults(true)
                    if (selectedIngredient) {
                      setSelectedIngredient(null)
                      setNewPrice("")
                    }
                  }}
                  onFocus={() => { if (!selectedIngredient) setShowPriceIngredientResults(true) }}
                />
                {(selectedIngredient || priceIngredientSearch) && (
                  <button type="button" onClick={() => { setSelectedIngredient(null); setPriceIngredientSearch(""); setNewPrice(""); setShowPriceIngredientResults(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {showPriceIngredientResults && !selectedIngredient && (
                <div className="mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredPriceIngredients.length > 0 ? (
                    filteredPriceIngredients.map(ing => (
                      <button key={ing.id} type="button" className="w-full px-4 py-2.5 text-left hover:bg-primary/10 flex items-center justify-between border-b last:border-b-0" onClick={() => { setSelectedIngredient(ing); setNewPrice(String(ing.ratePerUnit || "")); setPriceIngredientSearch(""); setShowPriceIngredientResults(false) }}>
                        <div>
                          <span className="font-medium">{ing.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({ing.unit})</span>
                        </div>
                        <span className="text-sm text-primary font-medium">₹{ing.ratePerUnit || 0}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-muted-foreground text-sm">
                      {priceIngredientSearch ? `No ingredients found for "${priceIngredientSearch}"` : "Type to search ingredients..."}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="label mb-1.5 block">New Price / नया मूल्य (₹) *</label>
              <Input type="number" placeholder="Enter new price" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />Date Range (Menu Creation Date)
              </p>
              <p className="text-xs text-muted-foreground mb-3">Only active events with menu created in this range will be updated</p>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" placeholder="Start Date" value={priceStartDate} onChange={e => setPriceStartDate(e.target.value)} />
                <Input type="date" placeholder="End Date" value={priceEndDate} onChange={e => setPriceEndDate(e.target.value)} />
              </div>
            </div>

            {selectedIngredient && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="font-medium text-amber-800">What will happen:</p>
                <ul className="text-amber-700 mt-1 space-y-1 text-xs">
                  <li>• Default price of &quot;{selectedIngredient.name}&quot; → ₹{newPrice || 0}/{selectedIngredient.unit}</li>
                  {priceStartDate && priceEndDate ? (
                    <li>• Active events (menu created {priceStartDate} to {priceEndDate}) will be updated</li>
                  ) : (
                    <li>• Only default price will be updated (no events affected)</li>
                  )}
                  <li>• Completed events will NOT be changed</li>
                </ul>
              </div>
            )}

            <Button onClick={handleBulkPriceUpdate} loading={updatingPrice} className="w-full" disabled={!selectedIngredient || !newPrice}>
              <Save className="w-4 h-4 mr-2" />Update Price / मूल्य अपडेट करें
            </Button>
          </div>
        </Card>
      </div>

      {/* CHANGED: the Edit Item and Edit Ingredient dialogs moved to
          components/inventory. They were pure markup driven by state this page
          already owns, so the page keeps the state and handlers and just passes them. */}
      <EditItemDialog
        open={editItemDialogOpen}
        onOpenChange={setEditItemDialogOpen}
        name={editItemName}
        onNameChange={setEditItemName}
        categoryId={editItemCatId}
        onCategoryChange={setEditItemCatId}
        categories={itemCategories}
        onSave={handleEditItem}
        saving={savingItemEdit}
      />

      <EditIngredientDialog
        open={editIngDialogOpen}
        onOpenChange={setEditIngDialogOpen}
        name={editIngName}
        onNameChange={setEditIngName}
        categoryId={editIngCatId}
        onCategoryChange={setEditIngCatId}
        unit={editIngUnit}
        onUnitChange={setEditIngUnit}
        categories={ingredientCategories}
        onSave={handleEditIngredient}
        saving={savingIngEdit}
      />

      <RecipeDialog
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        item={selectedItem}
        ingredientCategories={ingredientCategories}
        allIngredients={allIngredientsFlat}
        copyableItems={copyableItems}
        selectedIngredientIds={selectedIngredientIds}
        onToggleIngredient={toggleIngredientForRecipe}
        onCopyRecipe={handleCopyRecipe}
        copying={copyingRecipe}
        onSave={handleSaveRecipe}
        saving={savingRecipe}
      />
    </div>
  )
}