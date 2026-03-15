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
  Building2,
  UtensilsCrossed,
  Search,
  Trash2
} from "lucide-react"
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, Loading, Badge, QuantityInput } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event, EventIngredient, ItemCategory, Item, EventCategorySetting } from "@/types"
import { formatDate, cn } from "@/lib/utils"

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast / नाश्ता" },
  { value: "lunch", label: "Lunch / दोपहर का भोजन" },
  { value: "high-tea", label: "High Tea / हाई टी" },
  { value: "dinner", label: "Dinner / रात का भोजन" },
  { value: "brunch", label: "Brunch / ब्रंच" },
  { value: "snacks", label: "Snacks / स्नैक्स" },
]

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

// Represents one meal section (parent or sub-event)
interface MealInfo {
  id: string
  functionTime: string
  functionDate: string | Date
  guestCount: number
  eventItems: any[]
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
  
  const [categorySettings, setCategorySettings] = useState<Record<string, 'caterer' | 'client'>>({})
  const [ingredientStatus, setIngredientStatus] = useState<Record<string, 'normal' | 'new' | 'removed'>>({})
  const previousIngredientIds = useRef<Set<string>>(new Set())
  
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const [addingItems, setAddingItems] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)

  // Track which meal section the "Modify" dialog is editing
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [dialogSearch, setDialogSearch] = useState("")

  // Add/remove sub-event (meal) state
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false)
  const [newMealDate, setNewMealDate] = useState("")
  const [newMealType, setNewMealType] = useState("")
  const [newMealGuests, setNewMealGuests] = useState("")
  const [newMealItems, setNewMealItems] = useState<Item[]>([])
  const [creatingMeal, setCreatingMeal] = useState(false)
  const [deletingSubEventId, setDeletingSubEventId] = useState<string | null>(null)

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
        
        // Initialize quantities from parent event's ingredients
        const qty: Record<string, number> = {}
        const currentIngredientIds = new Set<string>()
        
        eventData.eventIngredients?.forEach((ei: EventIngredient) => {
          if (preserveQuantities && quantities[ei.ingredientId] !== undefined) {
            qty[ei.ingredientId] = quantities[ei.ingredientId]
          } else {
            qty[ei.ingredientId] = ei.quantity
          }
          currentIngredientIds.add(ei.ingredientId)
        })

        // Also include sub-events' ingredients in the quantities map
        // Merge: if same ingredient exists in parent and sub-event, sum quantities
        eventData.subEvents?.forEach((sub: any) => {
          sub.eventIngredients?.forEach((ei: any) => {
            if (preserveQuantities && qty[ei.ingredientId] !== undefined) {
              // already has a value, keep it
            } else if (qty[ei.ingredientId] !== undefined) {
              qty[ei.ingredientId] += ei.quantity
            } else {
              qty[ei.ingredientId] = ei.quantity
            }
            currentIngredientIds.add(ei.ingredientId)
          })
        })

        setQuantities(qty)
        
        const settings: Record<string, 'caterer' | 'client'> = {}
        eventData.eventCategorySettings?.forEach((cs: EventCategorySetting) => {
          settings[cs.ingredientCategoryId] = cs.boughtBy
        })
        setCategorySettings(settings)
        
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

  // Build meal sections from parent + sub-events
  const mealSections = useMemo((): MealInfo[] => {
    if (!event) return []
    const meals: MealInfo[] = [
      {
        id: event.id,
        functionTime: event.functionTime,
        functionDate: event.functionDate,
        guestCount: event.guestCount,
        eventItems: event.eventItems || []
      }
    ]
    // Add sub-events as additional meals
    const subEvents = (event as any).subEvents || []
    subEvents.forEach((sub: any) => {
      meals.push({
        id: sub.id,
        functionTime: sub.functionTime,
        functionDate: sub.functionDate,
        guestCount: sub.guestCount,
        eventItems: sub.eventItems || []
      })
    })
    return meals
  }, [event])

  // Group ingredients — merge parent + sub-events into one list
  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event) return []
    
    // Collect all event ingredients from parent + sub-events
    const allIngredients: any[] = [
      ...(event.eventIngredients || []),
      ...((event as any).subEvents || []).flatMap((sub: any) => sub.eventIngredients || [])
    ]
    
    const groups: Record<string, GroupedIngredient> = {}
    // Track merged quantities per ingredient to avoid duplicates
    const seen: Record<string, boolean> = {}
    
    allIngredients.forEach(ei => {
      const catId = ei.ingredient?.category?.id || "uncategorized"
      const catName = ei.ingredient?.category?.name || "Other"
      const ingId = ei.ingredientId
      
      if (!groups[catId]) {
        groups[catId] = {
          categoryId: catId,
          categoryName: catName,
          boughtBy: categorySettings[catId] || 'caterer',
          ingredients: []
        }
      }

      // Only add each ingredient once (quantities are already merged in the quantities map)
      if (!seen[ingId]) {
        seen[ingId] = true
        const eventPrice = ei.priceAtEvent ?? ei.ingredient?.ratePerUnit ?? 0
        const status: 'normal' | 'new' | 'removed' = ingredientStatus[ingId] || 'normal'
        
        groups[catId].ingredients.push({
          id: ei.id,
          ingredientId: ingId,
          name: ei.ingredient?.name || "Unknown",
          unit: ei.ingredient?.unit || "",
          price: eventPrice,
          quantity: quantities[ingId] || 0,
          status
        })
      }
    })
    
    Object.values(groups).forEach(group => {
      group.ingredients.sort((a, b) => a.name.localeCompare(b.name))
    })
    
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [event, quantities, ingredientStatus, categorySettings])

  const updateQuantity = (ingredientId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [ingredientId]: quantity }))
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
      // Save quantities for parent event's ingredients
      const parentIngIds = new Set(
        (event?.eventIngredients || []).map((ei: any) => ei.ingredientId)
      )
      const parentData = Object.entries(quantities)
        .filter(([id]) => parentIngIds.has(id))
        .map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
      
      await fetch(`/api/events/${params.eventId}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: parentData })
      })

      // Save quantities for each sub-event's ingredients
      const subEvents = (event as any)?.subEvents || []
      for (const sub of subEvents) {
        const subIngIds = new Set(
          (sub.eventIngredients || []).map((ei: any) => ei.ingredientId)
        )
        const subData = Object.entries(quantities)
          .filter(([id]) => subIngIds.has(id))
          .map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
        
        if (subData.length > 0) {
          await fetch(`/api/events/${sub.id}/ingredients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ingredients: subData })
          })
        }
      }

      setIngredientStatus({})
      toast({ title: "Success", description: "Quantities saved! / मात्रा सहेजी गई!" })
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

  const openItemDialog = (mealId?: string) => {
    setEditingMealId(mealId || event?.id || null)
    setDialogSearch("")
    fetchItemCategories()
    setItemDialogOpen(true)
  }

  // Determine which event ID to modify items on (parent or sub-event)
  const editTargetEventId = editingMealId || params.eventId

  const addMenuItem = async (itemId: string) => {
    setAddingItems(true)
    
    let itemIngredientIds: string[] = []
    try {
      const itemRes = await fetch(`/api/items/${itemId}/ingredients`)
      const itemData = await itemRes.json()
      if (itemData.success) {
        itemIngredientIds = itemData.data.map((ii: any) => ii.ingredientId)
      }
    } catch (e) {}
    
    try {
      const res = await fetch(`/api/events/${editTargetEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addItems: [itemId] })
      })
      const data = await res.json()
      if (data.success) {
        setIngredientStatus(prev => {
          const newStatus = { ...prev }
          itemIngredientIds.forEach(ingId => { newStatus[ingId] = 'new' })
          return newStatus
        })
        await fetchEvent(true)
        toast({ title: "Success", description: "Menu item added - green items need quantity increase" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" })
    } finally {
      setAddingItems(false)
    }
  }

  const removeMenuItem = async (itemId: string, fromEventId?: string) => {
    setRemovingItemId(itemId)
    const targetId = fromEventId || params.eventId
    
    let itemIngredientIds: string[] = []
    try {
      const itemRes = await fetch(`/api/items/${itemId}/ingredients`)
      const itemData = await itemRes.json()
      if (itemData.success) {
        itemIngredientIds = itemData.data.map((ii: any) => ii.ingredientId)
      }
    } catch (e) {}
    
    try {
      const res = await fetch(`/api/events/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItems: [itemId] })
      })
      const data = await res.json()
      if (data.success) {
        setIngredientStatus(prev => {
          const newStatus = { ...prev }
          itemIngredientIds.forEach(ingId => { newStatus[ingId] = 'removed' })
          return newStatus
        })
        await fetchEvent(true)
        toast({ title: "Success", description: "Menu item removed - red items need quantity reduction" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" })
    } finally {
      setRemovingItemId(null)
    }
  }

  // Delete a sub-event (meal)
  const handleDeleteSubEvent = async (subEventId: string) => {
    if (!confirm("Delete this meal and all its menu items? / यह भोजन हटाएं?")) return
    setDeletingSubEventId(subEventId)
    try {
      const res = await fetch(`/api/events/${subEventId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        toast({ title: "Success", description: "Meal deleted / भोजन हटाया गया" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setDeletingSubEventId(null)
    }
  }

  // Add a new sub-event (meal)
  const handleAddMeal = async () => {
    if (!event || !newMealDate || !newMealType || !newMealGuests) {
      toast({ title: "Error", description: "Fill date, meal type, and guest count", variant: "destructive" })
      return
    }
    setCreatingMeal(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerName: event.organizerName,
          phoneNumber: event.phoneNumber,
          location: event.location,
          functionDate: newMealDate,
          functionTime: newMealType,
          menuCreationDate: new Date().toISOString().split("T")[0],
          guestCount: newMealGuests,
          perPlatePrice: 0,
          totalAmount: 0,
          notes: "",
          selectedItems: newMealItems.map(i => i.id),
          parentEventId: event.id
        })
      })
      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        setAddMealDialogOpen(false)
        setNewMealDate("")
        setNewMealType("")
        setNewMealGuests("")
        setNewMealItems([])
        toast({ title: "Success", description: "Meal added / भोजन जोड़ा गया" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setCreatingMeal(false)
    }
  }

  const toggleCategory = (catId: string) => {
    setExpandedCats(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  const totalIngredientCost = useMemo(() => {
    return groupedIngredients.reduce((total, group) => {
      return total + group.ingredients.reduce((groupTotal, ing) => {
        return groupTotal + (ing.price * ing.quantity)
      }, 0)
    }, 0)
  }, [groupedIngredients])

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
        <Button onClick={() => router.push("/event-menu")} className="mt-4">Back to Events</Button>
      </div>
    )
  }

  // Get selected item IDs for the meal being edited in the dialog
  const editingMeal = mealSections.find(m => m.id === editingMealId)
  const selectedItemIds = editingMeal?.eventItems?.map((ei: any) => ei.itemId) || []

  const totalIngredients = groupedIngredients.reduce((sum, g) => sum + g.ingredients.length, 0)
  const ingredientsWithQty = Object.values(quantities).filter(q => q > 0).length

  return (
    <div className="max-w-8xl mx-auto animate-in">
      <Button variant="ghost" onClick={() => router.push("/event-menu")} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Events
      </Button>

      {/* Event Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="primary" className="font-mono">{event.eventId}</Badge>
          <Badge variant="success">Active</Badge>
          {mealSections.length > 1 && (
            <Badge variant="secondary">{mealSections.length} meals</Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold">{event.organizerName}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(event.functionDate)}</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{event.functionTime}</span>
          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{event.guestCount} Guests</span>
          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
          {event.perPlatePrice > 0 && (
            <span className="flex items-center gap-1"><IndianRupee className="w-4 h-4" />{event.perPlatePrice}/plate</span>
          )}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        
        {/* LEFT COLUMN - Menu Items per meal */}
        <div className="w-[35%] shrink-0">
          <Card className="flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
            <div className="section-header shrink-0">
              <div className="section-title">
                <ChefHat className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Menu Items</h2>
                <Badge variant="primary">
                  {mealSections.reduce((sum, m) => sum + m.eventItems.length, 0)}
                </Badge>
              </div>
            </div>
            
            <div className="px-1 pb-6 overflow-y-auto flex-1">
              {mealSections.map((meal, idx) => (
                <div key={meal.id} className={cn(idx > 0 && "mt-4 pt-3 border-t")}>
                  {/* Meal section header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className={cn("w-4 h-4", idx === 0 ? "text-primary" : "text-secondary")} />
                      <span className="text-sm font-semibold capitalize">{meal.functionTime}</span>
                      {mealSections.length > 1 && (
                        <span className="text-xs text-muted-foreground">({formatDate(meal.functionDate)})</span>
                      )}
                      <Badge variant="secondary" className="text-xs">{meal.guestCount}g</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-1 py-1.5" onClick={() => openItemDialog(meal.id)}>
                        <Edit className="w-4 h-4 mr-1.5" />Modify Menu
                      </Button>
                      {/* Delete button — only on sub-events, not on parent */}
                      {idx > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                          onClick={() => handleDeleteSubEvent(meal.id)}
                          loading={deletingSubEventId === meal.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Items grid for this meal */}
                  <div className="grid grid-cols-2 gap-2">
                    {meal.eventItems.map((ei: any) => (
                      <div key={ei.id} className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
                        <span className="font-medium text-sm flex-1 truncate" title={ei.item?.name}>{ei.item?.name}</span>
                        <button
                          onClick={() => removeMenuItem(ei.itemId, meal.id)}
                          disabled={removingItemId === ei.itemId}
                          className="w-5 h-5 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {meal.eventItems.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-3">No items yet</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Meal button */}
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => {
                    setNewMealDate("")
                    setNewMealType("")
                    setNewMealGuests(String(event?.guestCount || ""))
                    setNewMealItems([])
                    fetchItemCategories()
                    setAddMealDialogOpen(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Meal / भोजन जोड़ें
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN - Ingredients (merged from all meals) */}
        <div className="flex-1 min-w-0">
          <Card className="flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
            <div className="section-header shrink-0">
              <div className="section-title">
                <Package className="w-5 h-5 text-secondary" />
                <h2 className="text-lg font-semibold">Ingredients / सामग्री</h2>
                <Badge variant={ingredientsWithQty === totalIngredients ? "success" : "warning"}>
                  {ingredientsWithQty}/{totalIngredients} set
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing}>
                  <RefreshCw className="w-4 h-4 mr-1" />Refresh
                </Button>
                <Button size="sm" onClick={handleSave} loading={saving}>
                  <Save className="w-4 h-4 mr-1" />Save
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6">
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
                Combined ingredients from all meals. Set quantities for each ingredient.
                <br /><span className="text-xs">सभी भोजन की संयुक्त सामग्री। प्रत्येक सामग्री के लिए मात्रा निर्धारित करें।</span>
              </p>

              {groupedIngredients.length === 0 ? (
                <div className="empty-state">
                  <Package className="empty-state-icon" />
                  <p>No ingredients found</p>
                  <p className="text-sm">Add recipes to menu items in Customize Inventory</p>
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {groupedIngredients.map(group => (
                    <div key={group.categoryId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{group.categoryName}</span>
                          <Badge variant="secondary">{group.ingredients.length}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Bought by:</span>
                          <div className="flex rounded-lg border overflow-hidden">
                            <button type="button" className={cn("px-3 py-1.5 text-sm flex items-center gap-1 transition-colors", group.boughtBy === 'caterer' ? "bg-primary text-white" : "bg-white hover:bg-muted")} onClick={() => updateCategorySetting(group.categoryId, 'caterer')}>
                              <Building2 className="w-3 h-3" />Caterer
                            </button>
                            <button type="button" className={cn("px-3 py-1.5 text-sm flex items-center gap-1 transition-colors", group.boughtBy === 'client' ? "bg-secondary text-white" : "bg-white hover:bg-muted")} onClick={() => updateCategorySetting(group.categoryId, 'client')}>
                              <User className="w-3 h-3" />Client
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.ingredients.map(ing => (
                          <div key={ing.id} className={cn("p-3 rounded-lg border transition-colors", ing.status === 'new' && "bg-green-50 border-green-400", ing.status === 'removed' && "bg-red-50 border-red-400", ing.status === 'normal' && "bg-muted/30")}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-sm truncate flex-1" title={ing.name}>{ing.name}</div>
                              {ing.price > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center shrink-0 ml-1">
                                  <IndianRupee className="w-3 h-3" />{ing.price}/{ing.unit}
                                </span>
                              )}
                            </div>
                            <QuantityInput value={quantities[ing.ingredientId] || 0} onChange={(val) => updateQuantity(ing.ingredientId, val)} unit={ing.unit} step={0.5} />
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
              <div className="mt-6 pt-4 border-t pb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Caterer Cost</p>
                    <p className="text-xl font-bold flex items-center"><IndianRupee className="w-4 h-4" />{costByBuyer.catererCost.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Client Cost</p>
                    <p className="text-xl font-bold flex items-center"><IndianRupee className="w-4 h-4" />{costByBuyer.clientCost.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Ingredient Cost</p>
                    <p className="text-xl font-bold flex items-center text-primary"><IndianRupee className="w-4 h-4" />{totalIngredientCost.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleSave} loading={saving}>
                    <Save className="w-4 h-4 mr-2" />Save All Quantities / सभी मात्रा सहेजें
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add/Remove Items Dialog — operates on the specific meal being edited */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => { setItemDialogOpen(open); if (!open) setDialogSearch("") }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Modify Menu Items
              {editingMeal && (
                <Badge variant="secondary" className="capitalize">{editingMeal.functionTime}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Search bar in dialog */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Search menu items... / मेन्यू खोजें..."
              value={dialogSearch}
              onChange={e => setDialogSearch(e.target.value)}
              autoFocus
            />
            {dialogSearch && (
              <button type="button" onClick={() => setDialogSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {loadingItems ? (
            <Loading className="min-h-[200px]" />
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto mt-2">
              {itemCategories
                .map(cat => {
                  // Filter items within each category based on search
                  const filteredItems = dialogSearch.trim()
                    ? (cat.items || []).filter(item => item.name.toLowerCase().includes(dialogSearch.toLowerCase()))
                    : (cat.items || [])
                  // Show category if its name matches or it has matching items
                  const catMatches = cat.name.toLowerCase().includes(dialogSearch.toLowerCase())
                  if (!catMatches && filteredItems.length === 0) return null
                  const itemsToShow = catMatches ? (cat.items || []) : filteredItems

                  return (
                    <div key={cat.id} className="border rounded-lg overflow-hidden">
                      <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                        <div className="flex items-center gap-2">
                          <ChevronDown className={cn("w-4 h-4 transition-transform", (expandedCats.includes(cat.id) || dialogSearch.trim()) && "rotate-180")} />
                          <span className="font-medium">{cat.name}</span>
                          <span className="badge-primary">{itemsToShow.length}</span>
                        </div>
                      </div>
                      
                      {(expandedCats.includes(cat.id) || dialogSearch.trim()) && (
                        <div className="p-2 grid grid-cols-2 gap-2">
                          {itemsToShow.map(item => {
                            const isSelected = selectedItemIds.includes(item.id)
                            return (
                              <button type="button" key={item.id} disabled={addingItems} className={cn("p-3 rounded-lg border text-left transition-all", isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted hover:border-primary/50")} onClick={() => isSelected ? removeMenuItem(item.id, editingMealId || undefined) : addMenuItem(item.id)}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{item.name}</span>
                                  {isSelected ? <X className="w-4 h-4 text-destructive" /> : <Plus className="w-4 h-4 text-primary" />}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
                .filter(Boolean)}
              {dialogSearch.trim() && itemCategories.every(cat => {
                const items = (cat.items || []).filter(i => i.name.toLowerCase().includes(dialogSearch.toLowerCase()))
                return items.length === 0 && !cat.name.toLowerCase().includes(dialogSearch.toLowerCase())
              }) && (
                <p className="text-sm text-muted-foreground text-center py-4">No items found for &quot;{dialogSearch}&quot;</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meal Dialog */}
      <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />
              Add Meal / भोजन जोड़ें
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label mb-1 block text-xs">Date / तारीख *</label>
                <Input type="date" value={newMealDate} onChange={e => setNewMealDate(e.target.value)} />
              </div>
              <div>
                <label className="label mb-1 block text-xs">Meal Type *</label>
                <Select value={newMealType} onValueChange={setNewMealType}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map(mt => (
                      <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label mb-1 block text-xs">Guests *</label>
                <Input type="number" placeholder="0" value={newMealGuests} onChange={e => setNewMealGuests(e.target.value)} />
              </div>
            </div>

            {/* Selected items for new meal */}
            <div>
              <p className="text-sm font-medium mb-2">
                Selected Items ({newMealItems.length})
              </p>
              {newMealItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                  Select items from categories below
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {newMealItems.map(item => (
                    <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm">
                      <span className="font-medium">{item.name}</span>
                      <button type="button" onClick={() => setNewMealItems(prev => prev.filter(i => i.id !== item.id))} className="w-4 h-4 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Browse categories to add items */}
            <div className="space-y-2 max-h-[250px] overflow-y-auto border rounded-lg p-2">
              {loadingItems ? (
                <Loading className="min-h-[100px]" />
              ) : (
                itemCategories.map(cat => (
                  <div key={cat.id} className="border rounded-lg overflow-hidden">
                    <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                      <div className="flex items-center gap-2">
                        <ChevronDown className={cn("w-4 h-4 transition-transform", expandedCats.includes(cat.id) && "rotate-180")} />
                        <span className="font-medium">{cat.name}</span>
                        <span className="badge-primary">{cat.items?.length || 0}</span>
                      </div>
                    </div>
                    {expandedCats.includes(cat.id) && (
                      <div className="p-2 grid grid-cols-2 gap-2">
                        {cat.items?.map(item => {
                          const isSelected = newMealItems.some(i => i.id === item.id)
                          return (
                            <button
                              type="button"
                              key={item.id}
                              className={cn("p-2.5 rounded-lg border text-left transition-all text-sm", isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted hover:border-primary/50")}
                              onClick={() => {
                                if (isSelected) {
                                  setNewMealItems(prev => prev.filter(i => i.id !== item.id))
                                } else {
                                  setNewMealItems(prev => [...prev, item])
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{item.name}</span>
                                {isSelected ? <X className="w-4 h-4 text-destructive" /> : <Plus className="w-4 h-4 text-primary" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMealDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMeal} loading={creatingMeal} disabled={!newMealDate || !newMealType || !newMealGuests}>
              <Plus className="w-4 h-4 mr-1" />Add Meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}