"use client"

import { useState, useCallback, useMemo } from "react"
import { 
  ChefHat, 
  Package, 
  Link2, 
  Plus, 
  Languages,
  Save,
  IndianRupee,
  Calendar
} from "lucide-react"
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, CategoryDropdown, EmptyState, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { ItemCategory, IngredientCategory, Item, Ingredient } from "@/types"

const UNITS = [
  { value: "Kg", label: "Kg (किलोग्राम)" },
  { value: "g", label: "g (ग्राम)" },
  { value: "L", label: "L (लीटर)" },
  { value: "ml", label: "ml (मिलीलीटर)" },
  { value: "pcs", label: "pcs (पीस)" },
  { value: "dozen", label: "dozen (दर्जन)" },
  { value: "pkt", label: "pkt (पैकेट)" },
]

export default function CustomizeInventoryPage() {
  const { toast } = useToast()
  
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
  
  // Recipe builder
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([])
  const [savingRecipe, setSavingRecipe] = useState(false)
  const [expandedRecipeIngCats, setExpandedRecipeIngCats] = useState<string[]>([])
  
  // Bulk price update (4th box)
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null)
  const [newPrice, setNewPrice] = useState("")
  const [priceStartDate, setPriceStartDate] = useState("")
  const [priceEndDate, setPriceEndDate] = useState("")
  const [updatingPrice, setUpdatingPrice] = useState(false)

  // Get all ingredients flat for bulk update
  const allIngredients = useMemo(() => 
    ingredientCategories.flatMap(cat => cat.ingredients || []),
    [ingredientCategories]
  )

  // Add item category with optimistic update
  const handleAddItemCategory = useCallback(async () => {
    if (!newItemCatName.trim()) return
    setAddingItemCat(true)
    
    const tempId = `temp-${Date.now()}`
    const newCat = { id: tempId, name: newItemCatName.trim(), items: [] }
    
    // Optimistic update
    mutateItems({ success: true, data: [...itemCategories, newCat] } as any, false)
    setNewItemCatName("")
    toast({ title: "Success", description: "Category added" })
    
    try {
      await fetch("/api/categories/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCat.name })
      })
      mutateItems() // Revalidate
    } catch (error: any) {
      mutateItems() // Revert
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingItemCat(false)
    }
  }, [newItemCatName, itemCategories, mutateItems, toast])

  // Add ingredient category
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

  // Add item
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

  // Add ingredient
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

  // Delete item category
  const handleDeleteItemCategory = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its items?`)) return
    try {
      const res = await fetch(`/api/categories/items?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        mutateItems()
        toast({ title: "Success", description: "Category deleted" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }, [mutateItems, toast])

  // Delete ingredient category
  const handleDeleteIngCategory = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its ingredients?`)) return
    try {
      const res = await fetch(`/api/categories/ingredients?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        mutateIngredients()
        toast({ title: "Success", description: "Category deleted" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }, [mutateIngredients, toast])

  // Delete item
  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/items?id=${itemId}`, { method: "DELETE" })
      if (res.ok) {
        mutateItems()
        toast({ title: "Success", description: "Item deleted" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }, [mutateItems, toast])

  // Delete ingredient
  const handleDeleteIngredient = useCallback(async (ingId: string) => {
    try {
      const res = await fetch(`/api/ingredients?id=${ingId}`, { method: "DELETE" })
      if (res.ok) {
        mutateIngredients()
        toast({ title: "Success", description: "Ingredient deleted" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }, [mutateIngredients, toast])

  // Open recipe dialog
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
    setExpandedRecipeIngCats([])
    setRecipeDialogOpen(true)
  }, [])

  // Toggle ingredient selection for recipe
  const toggleIngredientForRecipe = useCallback((ingredientId: string) => {
    setSelectedIngredientIds(prev => 
      prev.includes(ingredientId)
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId]
    )
  }, [])

  // Save recipe with optimistic update
  const handleSaveRecipe = useCallback(async () => {
    if (!selectedItem) return
    setSavingRecipe(true)
    
    // Optimistic update - immediately update the UI
    const optimisticData = itemCategories.map(cat => ({
      ...cat,
      items: cat.items?.map(item => 
        item.id === selectedItem.id 
          ? { ...item, itemIngredients: selectedIngredientIds.map(id => ({ id })) }
          : item
      )
    }))
    
    // Update cache optimistically
    mutateItems({ success: true, data: optimisticData } as any, false)
    setRecipeDialogOpen(false)
    toast({ title: "Success", description: "Recipe saved / रेसिपी सहेजी गई" })
    
    try {
      await fetch(`/api/items/${selectedItem.id}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientIds: selectedIngredientIds })
      })
      // Revalidate in background
      mutateItems()
    } catch (error: any) {
      // Revert on error
      mutateItems()
      toast({ title: "Error", description: "Failed to save recipe", variant: "destructive" })
    } finally {
      setSavingRecipe(false)
    }
  }, [selectedItem, selectedIngredientIds, itemCategories, mutateItems, toast])

  // Get all items flat
  const allItems = itemCategories.flatMap(cat => cat.items || [])

  // Handle bulk price update
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
        // Reset form after success
        setSelectedIngredient(null)
        setNewPrice("")
        setPriceStartDate("")
        setPriceEndDate("")
        toast({ 
          title: "Success", 
          description: data.message || "Price updated successfully"
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUpdatingPrice(false)
    }
  }, [selectedIngredient, newPrice, priceStartDate, priceEndDate, mutateIngredients, toast])

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
        
        {/* Section 1: Menu Items */}
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

          {/* Add Category Input */}
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

          {/* Categories List */}
          {loadingItems ? (
            <Loading className="min-h-[200px]" />
          ) : itemCategories.length === 0 ? (
            <EmptyState icon={ChefHat} title="No categories yet" description="Add a category above" />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {itemCategories.map(cat => (
                <CategoryDropdown
                  key={cat.id}
                  category={{ id: cat.id, name: cat.name, items: cat.items || [] }}
                  expanded={expandedItemCats.includes(cat.id)}
                  onToggle={() => setExpandedItemCats(prev => 
                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                  )}
                  onDeleteCategory={() => handleDeleteItemCategory(cat.id, cat.name)}
                  onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                  showDelete
                />
              ))}
            </div>
          )}
        </Card>

        {/* Section 2: Ingredients */}
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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

          {/* Add Category Input */}
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

          {/* Categories List */}
          {loadingIngredients ? (
            <Loading className="min-h-[200px]" />
          ) : ingredientCategories.length === 0 ? (
            <EmptyState icon={Package} title="No categories yet" description="Add a category above" />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {ingredientCategories.map(cat => (
                <CategoryDropdown
                  key={cat.id}
                  category={{ 
                    id: cat.id, 
                    name: cat.name, 
                    items: cat.ingredients?.map(i => ({ id: i.id, name: i.name, unit: i.unit, ratePerUnit: i.ratePerUnit })) || [] 
                  }}
                  expanded={expandedIngCats.includes(cat.id)}
                  onToggle={() => setExpandedIngCats(prev => 
                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                  )}
                  onDeleteCategory={() => handleDeleteIngCategory(cat.id, cat.name)}
                  onDeleteItem={(ingId) => handleDeleteIngredient(ingId)}
                  showDelete
                  showPrice
                />
              ))}
            </div>
          )}
        </Card>

        {/* Section 3: Recipe Builder */}
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

          {loadingItems ? (
            <Loading className="min-h-[200px]" />
          ) : allItems.length === 0 ? (
            <EmptyState icon={Link2} title="No items yet" description="Add menu items first" />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {allItems.map(item => {
                const ingredientCount = item.itemIngredients?.length || 0
                return (
                  <div
                    key={item.id}
                    className="category-item cursor-pointer"
                    onClick={() => openRecipeDialog(item)}
                  >
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

        {/* Section 4: Bulk Price Update */}
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
            {/* Ingredient Selection */}
            <div>
              <label className="label mb-1.5 block">Select Ingredient / सामग्री चुनें *</label>
              <Select 
                value={selectedIngredient?.id || ""} 
                onValueChange={(id) => {
                  const ing = allIngredients.find(i => i.id === id)
                  if (ing) {
                    setSelectedIngredient(ing)
                    setNewPrice(String(ing.ratePerUnit || ""))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Search ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  {allIngredients.map(ing => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}) - ₹{ing.ratePerUnit || 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* New Price */}
            <div>
              <label className="label mb-1.5 block">New Price / नया मूल्य (₹) *</label>
              <Input
                type="number"
                placeholder="Enter new price"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
              />
            </div>

            {/* Date Range */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date Range (Menu Creation Date)
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Only active events with menu created in this range will be updated
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={priceStartDate}
                  onChange={e => setPriceStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={priceEndDate}
                  onChange={e => setPriceEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Info Box */}
            {selectedIngredient && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="font-medium text-amber-800">What will happen:</p>
                <ul className="text-amber-700 mt-1 space-y-1 text-xs">
                  <li>• Default price of "{selectedIngredient.name}" → ₹{newPrice || 0}/{selectedIngredient.unit}</li>
                  {priceStartDate && priceEndDate ? (
                    <li>• Active events (menu created {priceStartDate} to {priceEndDate}) will be updated</li>
                  ) : (
                    <li>• Only default price will be updated (no events affected)</li>
                  )}
                  <li>• Completed events will NOT be changed</li>
                </ul>
              </div>
            )}

            {/* Submit Button */}
            <Button 
              onClick={handleBulkPriceUpdate} 
              loading={updatingPrice}
              className="w-full"
              disabled={!selectedIngredient || !newPrice}
            >
              <Save className="w-4 h-4 mr-2" />
              Update Price / मूल्य अपडेट करें
            </Button>
          </div>
        </Card>
      </div>

      {/* Recipe Dialog */}
      <Dialog open={recipeDialogOpen} onOpenChange={setRecipeDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Recipe for: {selectedItem?.name}
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Click to add/remove ingredients / सामग्री जोड़ने या हटाने के लिए क्लिक करें
          </p>

          <div className="mt-4 max-h-[400px] overflow-y-auto space-y-2">
            {ingredientCategories.map(cat => (
              <CategoryDropdown
                key={cat.id}
                category={{ 
                  id: cat.id, 
                  name: cat.name, 
                  items: cat.ingredients?.map(i => ({ id: i.id, name: i.name, unit: i.unit })) || [] 
                }}
                expanded={expandedRecipeIngCats.includes(cat.id)}
                onToggle={() => setExpandedRecipeIngCats(prev => 
                  prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                )}
                onSelectItem={(item) => toggleIngredientForRecipe(item.id)}
                selectedItemIds={selectedIngredientIds}
                itemLabelSuffix={(item) => `(${item.unit})`}
                allowDeselect
              />
            ))}
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">
              Selected: {selectedIngredientIds.length} ingredients
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecipe} loading={savingRecipe}>
              <Save className="w-4 h-4 mr-2" />
              Save Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
