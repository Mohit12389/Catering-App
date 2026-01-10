"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  ArrowLeft, 
  ChefHat, 
  Calendar, 
  Clock, 
  Users, 
  MapPin,
  Save,
  RefreshCw,
  Package,
  Plus,
  X,
  ChevronDown,
  Edit,
  IndianRupee,
  User,
  Building2
} from "lucide-react"
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, Loading, Badge, QuantityInput } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event, EventIngredient, ItemCategory, Item, EventCategorySetting } from "@/types"
import { formatDate, cn } from "@/lib/utils"

interface GroupedIngredient {
  categoryId: string
  categoryName: string
  boughtBy: 'caterer' | 'client'
  ingredients: {
    id: string
    ingredientId: string
    name: string
    unit: string
    price: number
    quantity: number
    status: 'normal' | 'new' | 'removed'
  }[]
}

export default function EventMenuDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  
  // Category settings (caterer/client)
  const [categorySettings, setCategorySettings] = useState<Record<string, 'caterer' | 'client'>>({})
  
  // Track ingredient status (new/removed)
  const [ingredientStatus, setIngredientStatus] = useState<Record<string, 'normal' | 'new' | 'removed'>>({})
  const previousIngredientIds = useRef<Set<string>>(new Set())
  
  // Menu item modification
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const [addingItems, setAddingItems] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)

  useEffect(() => {
    fetchEvent()
  }, [params.eventId])

  const fetchEvent = async (preserveQuantities = false) => {
    try {
      const res = await fetch(`/api/events/${params.eventId}`)
      const data = await res.json()
      if (data.success) {
        const eventData = data.data
        setEvent(eventData)
        
        // Initialize quantities from event ingredients
        const qty: Record<string, number> = {}
        const currentIngredientIds = new Set<string>()
        
        eventData.eventIngredients?.forEach((ei: EventIngredient) => {
          // If preserving quantities, keep existing value for existing ingredients
          if (preserveQuantities && quantities[ei.ingredientId] !== undefined) {
            qty[ei.ingredientId] = quantities[ei.ingredientId]
          } else {
            qty[ei.ingredientId] = ei.quantity
          }
          currentIngredientIds.add(ei.ingredientId)
        })
        setQuantities(qty)
        
        // Initialize category settings
        const settings: Record<string, 'caterer' | 'client'> = {}
        eventData.eventCategorySettings?.forEach((cs: EventCategorySetting) => {
          settings[cs.ingredientCategoryId] = cs.boughtBy
        })
        setCategorySettings(settings)
        
        // On first load, store current ingredients
        if (previousIngredientIds.current.size === 0) {
          previousIngredientIds.current = currentIngredientIds
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load event", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchItemCategories = async () => {
    if (itemCategories.length > 0) return
    setLoadingItems(true)
    try {
      const res = await fetch("/api/categories/items")
      const data = await res.json()
      if (data.success) setItemCategories(data.data)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load items", variant: "destructive" })
    } finally {
      setLoadingItems(false)
    }
  }

  // Group ingredients by category with status
  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event?.eventIngredients) return []
    
    const groups: Record<string, GroupedIngredient> = {}
    
    event.eventIngredients.forEach(ei => {
      const catId = ei.ingredient?.category?.id || "uncategorized"
      const catName = ei.ingredient?.category?.name || "Other"
      
      if (!groups[catId]) {
        groups[catId] = {
          categoryId: catId,
          categoryName: catName,
          boughtBy: categorySettings[catId] || 'caterer',
          ingredients: []
        }
      }
      
      // Determine status - use the status from ingredientStatus state
      const status: 'normal' | 'new' | 'removed' = ingredientStatus[ei.ingredientId] || 'normal'
      
      groups[catId].ingredients.push({
        id: ei.id,
        ingredientId: ei.ingredientId,
        name: ei.ingredient?.name || "Unknown",
        unit: ei.ingredient?.unit || "",
        price: ei.ingredient?.ratePerUnit || 0,
        quantity: quantities[ei.ingredientId] || 0,
        status
      })
    })
    
    // Sort ingredients within each category
    Object.values(groups).forEach(group => {
      group.ingredients.sort((a, b) => a.name.localeCompare(b.name))
    })
    
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [event?.eventIngredients, quantities, ingredientStatus, categorySettings])

  const updateQuantity = (ingredientId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [ingredientId]: quantity }))
    // Clear status when quantity is set
    if (quantity > 0) {
      setIngredientStatus(prev => {
        const newStatus = { ...prev }
        delete newStatus[ingredientId]
        return newStatus
      })
    }
  }

  const updateCategorySetting = async (categoryId: string, boughtBy: 'caterer' | 'client') => {
    setCategorySettings(prev => ({ ...prev, [categoryId]: boughtBy }))
    
    // Save to API
    try {
      await fetch(`/api/events/${params.eventId}/category-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, boughtBy })
      })
    } catch (error) {
      console.error("Failed to save category setting")
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const ingredientData = Object.entries(quantities).map(([ingredientId, quantity]) => ({
        ingredientId,
        quantity
      }))
      
      const res = await fetch(`/api/events/${params.eventId}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredientData })
      })
      
      const data = await res.json()
      if (data.success) {
        // Clear all status after save
        setIngredientStatus({})
        toast({ title: "Success", description: "Quantities saved! / मात्रा सहेजी गई!" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/events/${params.eventId}/ingredients`, {
        method: "PUT"
      })
      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        toast({ title: "Success", description: "Ingredients refreshed from recipes" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to refresh", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  const openItemDialog = () => {
    fetchItemCategories()
    setItemDialogOpen(true)
  }

  const addMenuItem = async (itemId: string) => {
    setAddingItems(true)
    
    // Get the item's ingredients before adding
    let itemIngredientIds: string[] = []
    try {
      const itemRes = await fetch(`/api/items/${itemId}/ingredients`)
      const itemData = await itemRes.json()
      if (itemData.success) {
        itemIngredientIds = itemData.data.map((ii: any) => ii.ingredientId)
      }
    } catch (e) {}
    
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addItems: [itemId] })
      })
      const data = await res.json()
      if (data.success) {
        // First mark ALL ingredients from this item as 'new' (green)
        // This MUST happen BEFORE fetchEvent so the state is ready
        setIngredientStatus(prev => {
          const newStatus = { ...prev }
          itemIngredientIds.forEach(ingId => {
            newStatus[ingId] = 'new'
          })
          return newStatus
        })
        
        // Then fetch event but preserve existing quantities
        await fetchEvent(true)
        
        toast({ title: "Success", description: "Menu item added - green items need quantity increase" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" })
    } finally {
      setAddingItems(false)
    }
  }

  const removeMenuItem = async (itemId: string) => {
    setRemovingItemId(itemId)
    
    // Get the item's ingredients before removing
    let itemIngredientIds: string[] = []
    try {
      const itemRes = await fetch(`/api/items/${itemId}/ingredients`)
      const itemData = await itemRes.json()
      if (itemData.success) {
        itemIngredientIds = itemData.data.map((ii: any) => ii.ingredientId)
      }
    } catch (e) {}
    
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItems: [itemId] })
      })
      const data = await res.json()
      if (data.success) {
        // First mark ALL ingredients from this item as 'removed' (red)
        // This MUST happen BEFORE fetchEvent so the state is ready
        setIngredientStatus(prev => {
          const newStatus = { ...prev }
          itemIngredientIds.forEach(ingId => {
            newStatus[ingId] = 'removed'
          })
          return newStatus
        })
        
        // Then fetch event but preserve existing quantities
        await fetchEvent(true)
        
        toast({ title: "Success", description: "Menu item removed - red items need quantity reduction" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" })
    } finally {
      setRemovingItemId(null)
    }
  }

  const toggleCategory = (catId: string) => {
    setExpandedCats(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  // Calculate total ingredient cost
  const totalIngredientCost = useMemo(() => {
    return groupedIngredients.reduce((total, group) => {
      return total + group.ingredients.reduce((groupTotal, ing) => {
        return groupTotal + (ing.price * ing.quantity)
      }, 0)
    }, 0)
  }, [groupedIngredients])

  // Calculate cost by buyer
  const costByBuyer = useMemo(() => {
    let catererCost = 0
    let clientCost = 0
    
    groupedIngredients.forEach(group => {
      const groupCost = group.ingredients.reduce((sum, ing) => sum + (ing.price * ing.quantity), 0)
      if (group.boughtBy === 'client') {
        clientCost += groupCost
      } else {
        catererCost += groupCost
      }
    })
    
    return { catererCost, clientCost }
  }, [groupedIngredients])

  if (loading) return <Loading text="Loading event..." />
  
  if (!event) {
    return (
      <div className="empty-state">
        <p>Event not found</p>
        <Button onClick={() => router.push("/event-menu")} className="mt-4">
          Back to Events
        </Button>
      </div>
    )
  }

  const selectedItemIds = event.eventItems?.map(ei => ei.itemId) || []
  const totalIngredients = event.eventIngredients?.length || 0
  const ingredientsWithQty = Object.values(quantities).filter(q => q > 0).length

  return (
    <div className="max-w-5xl mx-auto animate-in">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push("/event-menu")} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Events
      </Button>

      {/* Event Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="primary" className="font-mono">{event.eventId}</Badge>
          <Badge variant="success">Active</Badge>
        </div>
        <h1 className="text-3xl font-bold">{event.organizerName}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(event.functionDate)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {event.functionTime}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {event.guestCount} Guests
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {event.location}
          </span>
          {event.perPlatePrice > 0 && (
            <span className="flex items-center gap-1">
              <IndianRupee className="w-4 h-4" />
              {event.perPlatePrice}/plate
            </span>
          )}
        </div>
      </div>

      {/* Menu Items with Add/Remove */}
      <Card className="mb-6">
        <div className="section-header">
          <div className="section-title">
            <ChefHat className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Menu Items / मेन्यू आइटम</h2>
            <Badge variant="primary">{event.eventItems?.length || 0}</Badge>
          </div>
          <Button size="sm" onClick={openItemDialog}>
            <Edit className="w-4 h-4 mr-1" />
            Modify
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {event.eventItems?.map(ei => (
            <div 
              key={ei.id} 
              className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-full"
            >
              <span className="font-medium text-sm">{ei.item?.name}</span>
              <button
                onClick={() => removeMenuItem(ei.itemId)}
                disabled={removingItemId === ei.itemId}
                className="w-5 h-5 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Ingredients Section */}
      <Card>
        <div className="section-header">
          <div className="section-title">
            <Package className="w-5 h-5 text-secondary" />
            <h2 className="text-lg font-semibold">Ingredients / सामग्री</h2>
            <Badge variant={ingredientsWithQty === totalIngredients ? "success" : "warning"}>
              {ingredientsWithQty}/{totalIngredients} set
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-400"></div>
            <span>New (increase qty) / नया</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-400"></div>
            <span>Removed (reduce qty) / हटाया</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Auto-populated from menu item recipes. Set quantities for each ingredient.
          <br />
          <span className="text-xs">मेन्यू आइटम की रेसिपी से स्वचालित रूप से भरा गया। प्रत्येक सामग्री के लिए मात्रा निर्धारित करें।</span>
        </p>

        {groupedIngredients.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon" />
            <p>No ingredients found</p>
            <p className="text-sm">Add recipes to menu items in Customize Inventory</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedIngredients.map(group => (
              <div key={group.categoryId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">
                      {group.categoryName}
                    </span>
                    <Badge variant="secondary">{group.ingredients.length}</Badge>
                  </div>
                  
                  {/* Caterer/Client Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Bought by:</span>
                    <div className="flex rounded-lg border overflow-hidden">
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-1.5 text-sm flex items-center gap-1 transition-colors",
                          group.boughtBy === 'caterer' 
                            ? "bg-primary text-white" 
                            : "bg-white hover:bg-muted"
                        )}
                        onClick={() => updateCategorySetting(group.categoryId, 'caterer')}
                      >
                        <Building2 className="w-3 h-3" />
                        Caterer
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-1.5 text-sm flex items-center gap-1 transition-colors",
                          group.boughtBy === 'client' 
                            ? "bg-secondary text-white" 
                            : "bg-white hover:bg-muted"
                        )}
                        onClick={() => updateCategorySetting(group.categoryId, 'client')}
                      >
                        <User className="w-3 h-3" />
                        Client
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.ingredients.map(ing => (
                    <div 
                      key={ing.id} 
                      className={cn(
                        "p-3 rounded-lg border transition-colors",
                        ing.status === 'new' && "bg-green-50 border-green-400",
                        ing.status === 'removed' && "bg-red-50 border-red-400",
                        ing.status === 'normal' && "bg-muted/30"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-sm truncate flex-1" title={ing.name}>
                          {ing.name}
                        </div>
                        {ing.price > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center shrink-0 ml-1">
                            <IndianRupee className="w-3 h-3" />
                            {ing.price}/{ing.unit}
                          </span>
                        )}
                      </div>
                      <QuantityInput
                        value={quantities[ing.ingredientId] || 0}
                        onChange={(val) => updateQuantity(ing.ingredientId, val)}
                        unit={ing.unit}
                        step={0.5}
                      />
                      {ing.quantity > 0 && ing.price > 0 && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center">
                          Cost: <IndianRupee className="w-3 h-3 ml-1" />{(ing.price * ing.quantity).toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total Cost Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Caterer Cost</p>
              <p className="text-xl font-bold flex items-center">
                <IndianRupee className="w-4 h-4" />
                {costByBuyer.catererCost.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Client Cost</p>
              <p className="text-xl font-bold flex items-center">
                <IndianRupee className="w-4 h-4" />
                {costByBuyer.clientCost.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Ingredient Cost</p>
              <p className="text-xl font-bold flex items-center text-primary">
                <IndianRupee className="w-4 h-4" />
                {totalIngredientCost.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save All Quantities / सभी मात्रा सहेजें
            </Button>
          </div>
        </div>
      </Card>

      {/* Add/Remove Items Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Modify Menu Items / मेन्यू आइटम संशोधित करें</DialogTitle>
          </DialogHeader>
          
          {loadingItems ? (
            <Loading className="min-h-[200px]" />
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto mt-4">
              {itemCategories.map(cat => (
                <div key={cat.id} className="border rounded-lg overflow-hidden">
                  <div 
                    className="category-header"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform",
                        expandedCats.includes(cat.id) && "rotate-180"
                      )} />
                      <span className="font-medium">{cat.name}</span>
                      <span className="badge-primary">{cat.items?.length || 0}</span>
                    </div>
                  </div>
                  
                  {expandedCats.includes(cat.id) && (
                    <div className="p-2 grid grid-cols-2 gap-2">
                      {cat.items?.map(item => {
                        const isSelected = selectedItemIds.includes(item.id)
                        return (
                          <button
                            type="button"
                            key={item.id}
                            disabled={addingItems}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              isSelected 
                                ? "bg-primary/10 border-primary/30"
                                : "hover:bg-muted hover:border-primary/50"
                            )}
                            onClick={() => isSelected ? removeMenuItem(item.id) : addMenuItem(item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{item.name}</span>
                              {isSelected ? (
                                <X className="w-4 h-4 text-destructive" />
                              ) : (
                                <Plus className="w-4 h-4 text-primary" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
