"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  ArrowLeft, ChefHat, Calendar, Clock, Users, MapPin, Home, Save, RefreshCw,
  Package, Plus, X, Edit, IndianRupee, User, Building2,
  UtensilsCrossed, Trash2, StickyNote
} from "lucide-react"
import { Button } from "@/components/ui"
import { Card, Loading, Badge, QuantityInput } from "@/components/shared"
import { ModifyItemsDialog, AddMealDialog, type NewMeal } from "@/components/event-menu" // CHANGED: extracted dialogs
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/apiClient" // CHANGED: normalises fetch + error handling
import type { ItemCategory } from "@/types"
import { formatDate, cn } from "@/lib/utils"
import { groupIntoMeals, groupIngredientsByCategory } from "@/lib/mealGroups"  // CHANGED: shared event projections
import { useConfirm } from "@/components/shared"

// =============================================
// CONSTANTS
// =============================================


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
  const confirm = useConfirm()
  
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
  const [addingItems, setAddingItems] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [editingMealKey, setEditingMealKey] = useState<string | null>(null)

  // ----- Add Meal Dialog State -----
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false)
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

  // CHANGED: shared groupIntoMeals — the composite-key grouping was an inline copy.
  // NOTE: no sortItems here, matching the previous behaviour (this page shows menu
  // items in selection order, not category-rank order).
  const mealGroups = useMemo((): MealGroup[] => groupIntoMeals(
    event?.eventItems as any[],
    (ei: any) => ({ id: ei.id, itemId: ei.itemId, name: ei.item?.name || "Unknown" })
  ), [event, refreshKey])

  // CHANGED: shared groupIngredientsByCategory (was an inline copy). boughtBy is a
  // group-level UI concern, so it is attached after grouping rather than inside it.
  const groupedIngredients = useMemo((): GroupedIngredient[] => groupIngredientsByCategory(
    event?.eventIngredients as any[],
    (ei: any) => ({
      id: ei.ingredient?.category?.id || "uncategorized",
      name: ei.ingredient?.category?.name || "Other",
      sortOrder: ei.ingredient?.category?.sortOrder || 0
    }),
    (ei: any) => ({
      id: ei.id, ingredientId: ei.ingredientId,
      name: ei.ingredient?.name || "Unknown",
      unit: ei.ingredient?.unit || "",
      price: ei.priceAtEvent ?? ei.ingredient?.ratePerUnit ?? 0,
      quantity: quantities[ei.ingredientId] || 0,
      status: ingredientStatus[ei.ingredientId] || ei.status || 'normal',
      notes: ingredientNotes[ei.ingredientId] || ei.notes || null
    }),
    {
      sortIngredients: (a, b) => a.name.localeCompare(b.name),
      tieBreakByName: true
    }
  ).map(g => ({ ...g, boughtBy: categorySettings[g.categoryId] || 'caterer' })),
  [event?.eventIngredients, quantities, ingredientStatus, categorySettings, ingredientNotes])

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
    const previous = categorySettings[categoryId]
    setCategorySettings(prev => ({ ...prev, [categoryId]: boughtBy }))
    try {
      // CHANGED: was a bare fetch with `catch {}` — silent whether it worked or not.
      // The toggle decides who pays for a whole ingredient category, so a failure that
      // leaves the UI showing the new value is a wrong procurement total later.
      await api.post(`/api/events/${params.eventId}/category-settings`, { categoryId, boughtBy })
    } catch (error: any) {
      setCategorySettings(prev => ({ ...prev, [categoryId]: previous }))
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" })
    }
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
      await api.post(`/api/events/${params.eventId}/ingredients`, { ingredients: ingredientData })
      setIngredientStatus({})
      toast({ title: "Success", description: "Quantities & notes saved!" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.put(`/api/events/${params.eventId}/ingredients`)
      setRefreshKey(k => k + 1)
      toast({ title: "Success", description: "Ingredients refreshed" })
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
    // CHANGED: ModifyItemsDialog clears its own search when it closes.
    fetchItemCategories()
    setItemDialogOpen(true)
  }

  const editingGroup = mealGroups.find(g => g.key === editingMealKey) || null

  const addMenuItem = async (itemId: string) => {
    setAddingItems(true)
    let itemIngredientIds: string[] = []
    try {
      // Best-effort: the item still gets added if its recipe cannot be read.
      const recipe = await api.get<{ ingredientId: string }[]>(`/api/items/${itemId}/ingredients`)
      itemIngredientIds = recipe.map(ii => ii.ingredientId)
    } catch {}
    
    try {
      await api.put(`/api/events/${params.eventId}`, {
        addItems: [{
          itemId,
          mealLabel: editingGroup?.label,
          mealDate: editingGroup?.date,
          mealGuests: editingGroup?.guests,
          mealPerPlate: editingGroup?.perPlate
        }]
      })
      setIngredientStatus(prev => {
        const s = { ...prev }
        itemIngredientIds.forEach(id => { s[id] = 'new' })
        return s
      })
      setRefreshKey(k => k + 1)
      toast({ title: "Success", description: "Item added" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" })
    } finally {
      setAddingItems(false)
    }
  }

  const removeMenuItem = async (eventItemId: string) => {
    const ok = await confirm({ title: "Remove this item?", description: "This will remove the menu item from this meal." })
    if (!ok) return
    setRemovingItemId(eventItemId)
    try {
      await api.put(`/api/events/${params.eventId}`, { removeItems: [eventItemId] })
      setRefreshKey(k => k + 1)
      toast({ title: "Success", description: "Item removed" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove item", variant: "destructive" })
    } finally {
      setRemovingItemId(null)
    }
  }

  const handleDeleteMealLabel = async (group: MealGroup) => {
    const ok = await confirm({ title: `Delete "${group.label}"?`, description: "All items in this meal will be removed. This cannot be undone." })
    if (!ok) return
    setDeletingMealKey(group.key)
    try {
      const itemIds = group.items.map(i => i.id)
      await api.put(`/api/events/${params.eventId}`, { removeItems: itemIds })
      setRefreshKey(k => k + 1)
      toast({ title: "Success", description: `"${group.label}" removed` })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete meal", variant: "destructive" })
    } finally {
      setDeletingMealKey(null)
    }
  }

  // CHANGED: takes the form values as an argument and reports whether it saved. The
  // new-meal form lives inside AddMealDialog now and clears itself on success.
  const handleAddMeal = async (meal: NewMeal): Promise<boolean> => {
    if (!meal.mealType || !meal.date || !meal.guests) {
      toast({ title: "Error", description: "Fill date, type, and guests", variant: "destructive" }); return false
    }
    if (meal.items.length === 0) {
      toast({ title: "Error", description: "Select at least one menu item", variant: "destructive" }); return false
    }
    setCreatingMeal(true)
    try {
      const items = meal.items.map(i => ({
        itemId: i.id, mealLabel: meal.mealType, mealDate: meal.date,
        mealGuests: parseInt(meal.guests) || 0,
        mealPerPlate: meal.perPlate !== "" ? parseFloat(meal.perPlate) : 0
      }))
      await api.put(`/api/events/${params.eventId}`, { addItems: items })
      setAddMealDialogOpen(false)
      setRefreshKey(k => k + 1)
      toast({ title: "Success", description: "Meal added" })
      return true
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
      return false
    } finally {
      setCreatingMeal(false)
    }
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
                  // CHANGED: AddMealDialog resets and seeds its own fields when it opens.
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
                      <IndianRupee className="w-4 h-4" />{costByBuyer.catererCost.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Client Cost</p>
                    <p className="text-xl font-bold flex items-center">
                      <IndianRupee className="w-4 h-4" />{costByBuyer.clientCost.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Ingredient Cost</p>
                    <p className="text-xl font-bold flex items-center text-primary">
                      <IndianRupee className="w-4 h-4" />{totalIngredientCost.toLocaleString("en-IN")}
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

      <ModifyItemsDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        mealLabel={editingGroup?.label}
        mealDate={editingGroup?.date}
        defaultMealLabel={event.functionTime}
        categories={itemCategories}
        loadingCategories={loadingItems}
        selectedItemIds={selectedItemIds}
        eventItemIdFor={itemId => editingGroup?.items.find(i => i.itemId === itemId)?.id}
        onAdd={addMenuItem}
        onRemove={removeMenuItem}
        busy={addingItems}
      />

      <AddMealDialog
        open={addMealDialogOpen}
        onOpenChange={setAddMealDialogOpen}
        categories={itemCategories}
        loadingCategories={loadingItems}
        defaultGuests={String(event?.guestCount || "")}
        onAdd={handleAddMeal}
        saving={creatingMeal}
      />
    </div>
  )
}