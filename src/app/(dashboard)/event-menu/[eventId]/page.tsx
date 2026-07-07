"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  ArrowLeft, ChefHat, Calendar, Clock, Users, MapPin, Home, Save, RefreshCw,
  Package, Plus, X, ChevronDown, Edit, IndianRupee, User, Building2,
  UtensilsCrossed, Search, Trash2, StickyNote
} from "lucide-react"
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, Loading, Badge, QuantityInput } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event, EventIngredient, ItemCategory, Item, EventCategorySetting } from "@/types"
import { formatDate, cn } from "@/lib/utils"

// =============================================
// CONSTANTS
// =============================================

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast / नाश्ता" },
  { value: "lunch", label: "Lunch / दोपहर का भोजन" },
  { value: "high-tea", label: "High Tea / हाई टी" },
  { value: "dinner", label: "Dinner / रात का भोजन" },
  { value: "brunch", label: "Brunch / ब्रंच" },
  { value: "snacks", label: "Snacks / स्नैक्स" },
]

// =============================================
// TYPES
// =============================================

interface MealGroup {
  key: string
  label: string
  date: string | null
  guests: number | null
  perPlate: number | null
  items: { id: string; itemId: string; name: string }[]
}

interface GroupedIngredient {
  categoryId: string
  categoryName: string
  sortOrder: number
  boughtBy: 'caterer' | 'client'
  ingredients: {
    id: string; ingredientId: string; name: string; unit: string;
    price: number; quantity: number; status: 'normal' | 'new' | 'removed' | 'shared';
    notes: string | null;
  }[]
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function EventMenuDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  // ----- Core State -----
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [ingredientNotes, setIngredientNotes] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [categorySettings, setCategorySettings] = useState<Record<string, 'caterer' | 'client'>>({})
  const [ingredientStatus, setIngredientStatus] = useState<Record<string, 'normal' | 'new' | 'removed'>>({})
  const previousIngredientIds = useRef<Set<string>>(new Set())
  
  // ----- Item Dialog State -----
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const [addingItems, setAddingItems] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [editingMealKey, setEditingMealKey] = useState<string | null>(null)
  const [dialogSearch, setDialogSearch] = useState("")

  // ----- Add Meal Dialog State -----
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false)
  const [newMealDate, setNewMealDate] = useState("")
  const [newMealType, setNewMealType] = useState("")
  const [newMealGuests, setNewMealGuests] = useState("")
  const [newMealPerPlate, setNewMealPerPlate] = useState("")
  const [newMealItems, setNewMealItems] = useState<Item[]>([])
  const [creatingMeal, setCreatingMeal] = useState(false)
  const [deletingMealKey, setDeletingMealKey] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // =============================================
  // DATA FETCHING
  // =============================================

  useEffect(() => { fetchEvent() }, [params.eventId, refreshKey])

  const fetchEvent = async (preserveQuantities = false) => {
    try {
      const res = await fetch(`/api/events/${params.eventId}?_=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        const eventData = data.data
        setEvent(eventData)

        const qty: Record<string, number> = {}
        const notes: Record<string, string> = {}
        const currentIds = new Set<string>()

        eventData.eventIngredients?.forEach((ei: any) => {
          qty[ei.ingredientId] = preserveQuantities && quantities[ei.ingredientId] !== undefined
            ? quantities[ei.ingredientId]
            : ei.quantity
          // Load notes from API
          if (ei.notes) notes[ei.ingredientId] = ei.notes
          currentIds.add(ei.ingredientId)
        })

        setQuantities(qty)
        // Only overwrite notes on fresh load, preserve on preserveQuantities
        if (!preserveQuantities) setIngredientNotes(notes)

        const settings: Record<string, 'caterer' | 'client'> = {}
        eventData.eventCategorySettings?.forEach((cs: any) => {
          settings[cs.ingredientCategoryId] = cs.boughtBy
        })
        setCategorySettings(settings)

        if (previousIngredientIds.current.size === 0) previousIngredientIds.current = currentIds
      }
    } catch {
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
    } catch {
      toast({ title: "Error", description: "Failed to load items", variant: "destructive" })
    } finally {
      setLoadingItems(false)
    }
  }

  // =============================================
  // COMPUTED DATA
  // =============================================

  const mealGroups = useMemo((): MealGroup[] => {
    if (!event?.eventItems || !Array.isArray(event.eventItems)) return []
    const groups: Record<string, MealGroup> = {}
    event.eventItems.forEach((ei: any) => {
      const label = ei.mealLabel || "default"
      const dateStr = ei.mealDate ? String(ei.mealDate).split("T")[0] : ""
      const key = `${label}::${dateStr}`
      if (!groups[key]) {
        groups[key] = {
          key, label,
          date: ei.mealDate ? String(ei.mealDate) : null,
          guests: ei.mealGuests ?? null,
          perPlate: ei.mealPerPlate ?? null,
          items: []
        }
      }
      groups[key].items.push({ id: ei.id, itemId: ei.itemId, name: ei.item?.name || "Unknown" })
    })
    return Object.values(groups)
  }, [event, refreshKey])

  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event?.eventIngredients) return []
    const groups: Record<string, GroupedIngredient> = {}
    event.eventIngredients.forEach((ei: any) => {
      const catId = ei.ingredient?.category?.id || "uncategorized"
      const catName = ei.ingredient?.category?.name || "Other"
      if (!groups[catId]) {
        groups[catId] = {
          categoryId: catId, categoryName: catName,
          sortOrder: ei.ingredient?.category?.sortOrder || 0,
          boughtBy: categorySettings[catId] || 'caterer',
          ingredients: []
        }
      }
      groups[catId].ingredients.push({
        id: ei.id, ingredientId: ei.ingredientId,
        name: ei.ingredient?.name || "Unknown",
        unit: ei.ingredient?.unit || "",
        price: ei.priceAtEvent ?? ei.ingredient?.ratePerUnit ?? 0,
        quantity: quantities[ei.ingredientId] || 0,
       status: ingredientStatus[ei.ingredientId] || ei.status || 'normal',
        notes: ingredientNotes[ei.ingredientId] || ei.notes || null
      })
    })
    Object.values(groups).forEach(g => g.ingredients.sort((a, b) => a.name.localeCompare(b.name)))
    return Object.values(groups).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.categoryName.localeCompare(b.categoryName))
  }, [event?.eventIngredients, quantities, ingredientStatus, categorySettings, ingredientNotes])

  // =============================================
  // HANDLERS
  // =============================================

   const updateQuantity = (ingredientId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [ingredientId]: quantity }))
    // CHANGED: Set status to 'normal' to clear "shared" indicator when qty updated
    setIngredientStatus(prev => ({ ...prev, [ingredientId]: 'normal' }))
  }

  const updateNote = (ingredientId: string, note: string) => {
    setIngredientNotes(prev => ({ ...prev, [ingredientId]: note }))
  }

  const toggleNoteExpanded = (ingredientId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(ingredientId)) next.delete(ingredientId)
      else next.add(ingredientId)
      return next
    })
  }

  const updateCategorySetting = async (categoryId: string, boughtBy: 'caterer' | 'client') => {
    setCategorySettings(prev => ({ ...prev, [categoryId]: boughtBy }))
    try {
      await fetch(`/api/events/${params.eventId}/category-settings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, boughtBy })
      })
    } catch {}
  }

  // Save quantities AND notes
  const handleSave = async () => {
    setSaving(true)
    try {
      const ingredientData = Object.entries(quantities).map(([ingredientId, quantity]) => ({
  ingredientId,
  quantity,
  notes: ingredientNotes[ingredientId] || null,
  ...(ingredientStatus[ingredientId] && { status: ingredientStatus[ingredientId] })
}))
      const res = await fetch(`/api/events/${params.eventId}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredientData })
      })
      if ((await res.json()).success) {
        setIngredientStatus({})
        toast({ title: "Success", description: "Quantities & notes saved!" })
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
      const res = await fetch(`/api/events/${params.eventId}/ingredients`, { method: "PUT" })
      if ((await res.json()).success) {
        setRefreshKey(k => k + 1)
        toast({ title: "Success", description: "Ingredients refreshed" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to refresh", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  // =============================================
  // MEAL / ITEM HANDLERS
  // =============================================

  const openItemDialog = (mealKey: string) => {
    setEditingMealKey(mealKey)
    setDialogSearch("")
    fetchItemCategories()
    setItemDialogOpen(true)
  }

  const editingGroup = mealGroups.find(g => g.key === editingMealKey) || null

  const addMenuItem = async (itemId: string) => {
    setAddingItems(true)
    let itemIngredientIds: string[] = []
    try {
      const r = await fetch(`/api/items/${itemId}/ingredients`)
      const d = await r.json()
      if (d.success) itemIngredientIds = d.data.map((ii: any) => ii.ingredientId)
    } catch {}
    
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addItems: [{
            itemId,
            mealLabel: editingGroup?.label,
            mealDate: editingGroup?.date,
            mealGuests: editingGroup?.guests,
            mealPerPlate: editingGroup?.perPlate
          }]
        })
      })
      if ((await res.json()).success) {
        setIngredientStatus(prev => {
          const s = { ...prev }
          itemIngredientIds.forEach(id => { s[id] = 'new' })
          return s
        })
        setRefreshKey(k => k + 1)
        toast({ title: "Success", description: "Item added" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" })
    } finally {
      setAddingItems(false)
    }
  }

  const removeMenuItem = async (eventItemId: string) => {
    setRemovingItemId(eventItemId)
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItems: [eventItemId] })
      })
      if ((await res.json()).success) {
        setRefreshKey(k => k + 1)
        toast({ title: "Success", description: "Item removed" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" })
    } finally {
      setRemovingItemId(null)
    }
  }

  const handleDeleteMealLabel = async (group: MealGroup) => {
    if (!confirm(`Delete all items in "${group.label}" (${group.date ? formatDate(group.date) : ""})?`)) return
    setDeletingMealKey(group.key)
    try {
      const itemIds = group.items.map(i => i.id)
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItems: itemIds })
      })
      if ((await res.json()).success) {
        setRefreshKey(k => k + 1)
        toast({ title: "Success", description: `"${group.label}" removed` })
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete meal", variant: "destructive" })
    } finally {
      setDeletingMealKey(null)
    }
  }

  const handleAddMeal = async () => {
    if (!newMealType || !newMealDate || !newMealGuests) {
      toast({ title: "Error", description: "Fill date, type, and guests", variant: "destructive" }); return
    }
    if (newMealItems.length === 0) {
      toast({ title: "Error", description: "Select at least one menu item", variant: "destructive" }); return
    }
    setCreatingMeal(true)
    try {
      const items = newMealItems.map(i => ({
        itemId: i.id, mealLabel: newMealType, mealDate: newMealDate,
        mealGuests: parseInt(newMealGuests) || 0,
        mealPerPlate: newMealPerPlate !== "" ? parseFloat(newMealPerPlate) : 0
      }))
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addItems: items })
      })
      if ((await res.json()).success) {
        setAddMealDialogOpen(false)
        setNewMealDate(""); setNewMealType(""); setNewMealGuests(""); setNewMealPerPlate(""); setNewMealItems([])
        setRefreshKey(k => k + 1)
        toast({ title: "Success", description: "Meal added" })
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setCreatingMeal(false)
    }
  }

  const toggleCategory = (catId: string) => {
    setExpandedCats(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId])
  }

  // =============================================
  // COMPUTED COSTS
  // =============================================

  const totalIngredientCost = useMemo(() =>
    groupedIngredients.reduce((t, g) => t + g.ingredients.reduce((s, i) => s + i.price * i.quantity, 0), 0),
    [groupedIngredients]
  )

  const costByBuyer = useMemo(() => {
    let catererCost = 0, clientCost = 0
    groupedIngredients.forEach(g => {
      const c = g.ingredients.reduce((s, i) => s + i.price * i.quantity, 0)
      g.boughtBy === 'client' ? clientCost += c : catererCost += c
    })
    return { catererCost, clientCost }
  }, [groupedIngredients])

  // =============================================
  // LOADING / ERROR
  // =============================================

  if (loading) return <Loading text="Loading event..." />
  if (!event) {
    return (
      <div className="empty-state">
        <p>Event not found</p>
        <Button onClick={() => router.push("/event-menu")} className="mt-4">Back to Events</Button>
      </div>
    )
  }

  const selectedItemIds = editingGroup?.items.map(i => i.itemId) || []
  const totalIngredients = groupedIngredients.reduce((s, g) => s + g.ingredients.length, 0)
  const ingredientsWithQty = Object.values(quantities).filter(q => q > 0).length

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="max-w-8xl mx-auto animate-in">
      <Button variant="ghost" onClick={() => router.push("/event-menu")} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Events
      </Button>

      {/* ========== Event Header ========== */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="primary" className="font-mono">{event.eventId}</Badge>
          <Badge variant="success">Active</Badge>
          {mealGroups.length > 1 && <Badge variant="secondary">{mealGroups.length} meals</Badge>}
        </div>
        <h1 className="text-3xl font-bold">{event.organizerName}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(event.functionDate)}</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{event.functionTime}</span>
          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{event.guestCount} Guests</span>
          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
          {event.homeAddress && (
            <span className="flex items-center gap-1"><Home className="w-4 h-4" />{event.homeAddress}</span>
          )}
        </div>
        {event.notes && (
          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <span className="font-medium">Notes:</span> {event.notes}
          </div>
        )}
      </div>

      {/* ========== Two Column Layout ========== */}
      <div className="flex gap-6 items-start">

        {/* ---------- LEFT: Menu Items ---------- */}
        <div className="w-[35%] shrink-0">
          <Card className="flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
            <div className="section-header shrink-0">
              <div className="section-title">
                <ChefHat className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Menu Items</h2>
                <Badge variant="primary">{event.eventItems?.length || 0}</Badge>
              </div>
            </div>
            
            <div className="px-2 pb-6 overflow-y-auto flex-1">
              {mealGroups.map((group, idx) => (
                <div key={group.key} className={cn(idx > 0 && "mt-4 pt-3 border-t")}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className={cn("w-4 h-4", idx === 0 ? "text-primary" : "text-secondary")} />
                      <span className="text-sm font-semibold capitalize">
                        {group.label === "default" ? event.functionTime : group.label}
                      </span>
                      {group.date && (
                        <span className="text-xs text-muted-foreground">({formatDate(group.date)})</span>
                      )}
                      {group.guests != null && (
                        <Badge variant="secondary" className="text-xs">{group.guests}g</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5" onClick={() => openItemDialog(group.key)}>
                        <Edit className="w-4 h-4 mr-1.5" />Modify
                      </Button>
                      {mealGroups.length > 1 && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 px-2" onClick={() => handleDeleteMealLabel(group)} loading={deletingMealKey === group.key}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
                        <span className="font-medium text-sm flex-1 truncate" title={item.name}>{item.name}</span>
                        <button onClick={() => removeMenuItem(item.id)} disabled={removingItemId === item.id} className="w-5 h-5 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add Meal button */}
              <div className="mt-4 pt-3 border-t">
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => {
                  setNewMealDate(""); setNewMealType("")
                  setNewMealGuests(String(event?.guestCount || ""))
                  setNewMealPerPlate(""); setNewMealItems([])
                  fetchItemCategories(); setAddMealDialogOpen(true)
                }}>
                  <Plus className="w-4 h-4 mr-1" />Add Meal / भोजन जोड़ें
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ---------- RIGHT: Ingredients ---------- */}
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
              {/* Legend */}
              <div className="flex flex-wrap gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100 border border-green-400"></div>
                  <span>New / नया</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100 border border-red-400"></div>
                  <span>Removed / हटाया</span>
                </div>
              </div>

              {groupedIngredients.length === 0 ? (
                <div className="empty-state">
                  <Package className="empty-state-icon" />
                  <p>No ingredients</p>
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {groupedIngredients.map(group => (
                    <div key={group.categoryId} className="border rounded-lg p-4">
                      {/* Category Header */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{group.categoryName}</span>
                          <Badge variant="secondary">{group.ingredients.length}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Bought by:</span>
                          <div className="flex rounded-lg border overflow-hidden">
                            <button
                              type="button"
                              className={cn("px-3 py-1.5 text-sm flex items-center gap-1 transition-colors",
                                group.boughtBy === 'caterer' ? "bg-primary text-white" : "bg-white hover:bg-muted"
                              )}
                              onClick={() => updateCategorySetting(group.categoryId, 'caterer')}
                            >
                              <Building2 className="w-3 h-3" />Caterer
                            </button>
                            <button
                              type="button"
                              className={cn("px-3 py-1.5 text-sm flex items-center gap-1 transition-colors",
                                group.boughtBy === 'client' ? "bg-secondary text-white" : "bg-white hover:bg-muted"
                              )}
                              onClick={() => updateCategorySetting(group.categoryId, 'client')}
                            >
                              <User className="w-3 h-3" />Client
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Ingredients Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.ingredients.map(ing => {
                          const hasNote = !!(ingredientNotes[ing.ingredientId] || ing.notes)
                          const isNoteOpen = expandedNotes.has(ing.ingredientId)

                          return (
                            <div
                              key={ing.id}
                              className={cn(
                                "p-3 rounded-lg border transition-colors",
                                ing.status === 'new' && "bg-green-50 border-green-400",
                                ing.status === 'removed' && "bg-red-50 border-red-400",
                                ing.status === 'normal' && "bg-muted/30",
                                ing.status === 'shared' && "bg-amber-50 border-amber-300"
                              )}
                            >
                              {/* Shared indicator at top of card */}
                              {ing.status === 'shared' && (
                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mb-2 flex items-center gap-1">
                                  ⚠️ Also in other meals — update qty
                                </div>
                              )}

                              {/* Name + Price */}
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-sm truncate flex-1" title={ing.name}>
                                  {ing.name}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  {/* Note toggle button */}
                                  <button
                                    type="button"
                                    onClick={() => toggleNoteExpanded(ing.ingredientId)}
                                    className={cn(
                                      "w-5 h-5 rounded flex items-center justify-center transition-colors",
                                      hasNote
                                        ? "text-amber-600 bg-amber-100 hover:bg-amber-200"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                    title={hasNote ? "Edit note" : "Add note"}
                                  >
                                    <StickyNote className="w-3 h-3" />
                                  </button>
                                  {ing.price > 0 && (
                                    <span className="text-xs text-muted-foreground flex items-center">
                                      <IndianRupee className="w-3 h-3" />{ing.price}/{ing.unit}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity Input */}
                              <QuantityInput
                                value={quantities[ing.ingredientId] || 0}
                                onChange={val => updateQuantity(ing.ingredientId, val)}
                                unit={ing.unit}
                                step={0.5}
                              />

                              {/* Cost */}
                              {ing.quantity > 0 && ing.price > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 flex items-center">
                                  Cost: <IndianRupee className="w-3 h-3 ml-1" />{(ing.price * ing.quantity).toFixed(2)}
                                </div>
                              )}

                              {/* Note input (expandable) */}
                              {isNoteOpen && (
                                <div className="mt-2">
                                  <input
                                    type="text"
                                    className="w-full text-xs px-2 py-1.5 border rounded-md bg-amber-50 border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                    placeholder="e.g. 25kg for bhaji box, 100kg separate"
                                    value={ingredientNotes[ing.ingredientId] || ""}
                                    onChange={e => updateNote(ing.ingredientId, e.target.value)}
                                  />
                                </div>
                              )}

                              {/* Show note text when collapsed (if has note) */}
                              {!isNoteOpen && hasNote && (
                                <p
                                  className="text-xs text-amber-700 mt-1 cursor-pointer hover:underline truncate"
                                  onClick={() => toggleNoteExpanded(ing.ingredientId)}
                                  title={ingredientNotes[ing.ingredientId] || ing.notes || ""}
                                >
                                  📝 {ingredientNotes[ing.ingredientId] || ing.notes}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cost Summary */}
              <div className="mt-6 pt-4 border-t pb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Caterer Cost</p>
                    <p className="text-xl font-bold flex items-center">
                      <IndianRupee className="w-4 h-4" />{costByBuyer.catererCost.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Client Cost</p>
                    <p className="text-xl font-bold flex items-center">
                      <IndianRupee className="w-4 h-4" />{costByBuyer.clientCost.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Ingredient Cost</p>
                    <p className="text-xl font-bold flex items-center text-primary">
                      <IndianRupee className="w-4 h-4" />{totalIngredientCost.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} loading={saving}>
                    <Save className="w-4 h-4 mr-2" />Save All / सभी सहेजें
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ========== Modify Items Dialog ========== */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => { setItemDialogOpen(open); if (!open) setDialogSearch("") }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Modify Menu Items
              {editingGroup && (
                <Badge variant="secondary" className="capitalize">
                  {editingGroup.label === "default" ? event.functionTime : editingGroup.label}
                </Badge>
              )}
              {editingGroup?.date && (
                <span className="text-sm text-muted-foreground font-normal">
                  ({formatDate(editingGroup.date)})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" className="input pl-10 w-full" placeholder="Search items..."
              value={dialogSearch} onChange={e => setDialogSearch(e.target.value)} autoFocus />
            {dialogSearch && (
              <button type="button" onClick={() => setDialogSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {loadingItems ? <Loading className="min-h-[200px]" /> : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto mt-2">
              {itemCategories.map(cat => {
                const filteredItems = dialogSearch.trim()
                  ? (cat.items || []).filter(i => i.name.toLowerCase().includes(dialogSearch.toLowerCase()))
                  : (cat.items || [])
                const catMatches = cat.name.toLowerCase().includes(dialogSearch.toLowerCase())
                if (!catMatches && filteredItems.length === 0) return null
                const itemsToShow = catMatches ? (cat.items || []) : filteredItems
                return (
                  <div key={cat.id} className="border rounded-lg overflow-hidden">
                    <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                      <div className="flex items-center gap-2">
                        <ChevronDown className={cn("w-4 h-4 transition-transform",
                          (expandedCats.includes(cat.id) || dialogSearch.trim()) && "rotate-180"
                        )} />
                        <span className="font-medium">{cat.name}</span>
                        <span className="badge-primary">{itemsToShow.length}</span>
                      </div>
                    </div>
                    {(expandedCats.includes(cat.id) || dialogSearch.trim()) && (
                      <div className="p-2 grid grid-cols-2 gap-2">
                        {itemsToShow.map(item => {
                          const isSelected = selectedItemIds.includes(item.id)
                          const eventItemId = editingGroup?.items.find(i => i.itemId === item.id)?.id
                          return (
                            <button type="button" key={item.id} disabled={addingItems}
                              className={cn("p-3 rounded-lg border text-left transition-all",
                                isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted hover:border-primary/50"
                              )}
                              onClick={() => isSelected && eventItemId ? removeMenuItem(eventItemId) : addMenuItem(item.id)}>
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
              }).filter(Boolean)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Add Meal Dialog ========== */}
      <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />Add Meal / भोजन जोड़ें
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="label mb-1 block text-xs">Date *</label>
                <Input type="date" value={newMealDate} onChange={e => setNewMealDate(e.target.value)} />
              </div>
              <div>
                <label className="label mb-1 block text-xs">Meal Type *</label>
                <Select value={newMealType} onValueChange={setNewMealType}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map(mt => <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label mb-1 block text-xs">Guests *</label>
                <Input type="number" placeholder="0" value={newMealGuests} onChange={e => setNewMealGuests(e.target.value)} />
              </div>
              <div>
                <label className="label mb-1 block text-xs">Per Plate (₹)</label>
                <Input type="number" placeholder="0" value={newMealPerPlate} onChange={e => setNewMealPerPlate(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Selected Items ({newMealItems.length})</p>
              {newMealItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                  Select items from below
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {newMealItems.map(item => (
                    <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm">
                      <span className="font-medium">{item.name}</span>
                      <button type="button" onClick={() => setNewMealItems(prev => prev.filter(i => i.id !== item.id))}
                        className="w-4 h-4 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto border rounded-lg p-2">
              {loadingItems ? <Loading className="min-h-[100px]" /> : itemCategories.map(cat => (
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
                        const sel = newMealItems.some(i => i.id === item.id)
                        return (
                          <button type="button" key={item.id}
                            className={cn("p-2.5 rounded-lg border text-left transition-all text-sm",
                              sel ? "bg-primary/10 border-primary/30" : "hover:bg-muted hover:border-primary/50"
                            )}
                            onClick={() => sel
                              ? setNewMealItems(prev => prev.filter(i => i.id !== item.id))
                              : setNewMealItems(prev => [...prev, item])
                            }>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{item.name}</span>
                              {sel ? <X className="w-4 h-4 text-destructive" /> : <Plus className="w-4 h-4 text-primary" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMealDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMeal} loading={creatingMeal}
              disabled={!newMealDate || !newMealType || !newMealGuests || newMealItems.length === 0}>
              <Plus className="w-4 h-4 mr-1" />Add Meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}