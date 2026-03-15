"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  CalendarPlus, 
  ChevronDown,
  ChevronUp,
  Check,
  ChefHat,
  X,
  CreditCard,
  IndianRupee,
  Plus,
  Search,
  Calendar,
  Phone,
  Trash2,
  UtensilsCrossed
} from "lucide-react"
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { ItemCategory, Item } from "@/types"
import { cn, formatDate } from "@/lib/utils"

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast / नाश्ता" },
  { value: "lunch", label: "Lunch / दोपहर का भोजन" },
  { value: "high-tea", label: "High Tea / हाई टी" },
  { value: "dinner", label: "Dinner / रात का भोजन" },
  { value: "brunch", label: "Brunch / ब्रंच" },
  { value: "snacks", label: "Snacks / स्नैक्स" },
]

// Each meal section has its own state
interface MealSection {
  id: string           // unique key for React
  functionDate: string
  mealType: string
  guestCount: string
  selectedItems: Item[]
  expanded: boolean
}

export default function CreateEventPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeMealId, setActiveMealId] = useState<string>("")
  const searchRef = useRef<HTMLDivElement>(null)

  // Available menu items category expand state
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  
  const { data: itemCategories = [], isLoading: loadingItems } = useSWRFetch<ItemCategory[]>('/api/categories/items')
  
  // Event-level details (shared across all meals)
  const [formData, setFormData] = useState({
    organizerName: "",
    location: "",
    menuCreationDate: new Date().toISOString().split('T')[0],
    perPlatePrice: "",
    notes: ""
  })
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([""])

  // Meal sections — start with one empty meal
  const [meals, setMeals] = useState<MealSection[]>([{
    id: `meal-${Date.now()}`,
    functionDate: "",
    mealType: "",
    guestCount: "",
    selectedItems: [],
    expanded: true
  }])

  // Phone number handlers
  const addPhoneNumber = () => {
    if (phoneNumbers.length < 4) setPhoneNumbers([...phoneNumbers, ""])
  }
  const removePhoneNumber = (index: number) => {
    if (phoneNumbers.length > 1) setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index))
  }
  const updatePhoneNumber = (index: number, value: string) => {
    const newPhones = [...phoneNumbers]
    newPhones[index] = value
    setPhoneNumbers(newPhones)
  }

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Set first meal as active by default
  useEffect(() => {
    if (meals.length > 0 && !activeMealId) {
      setActiveMealId(meals[0].id)
    }
  }, [meals, activeMealId])

  // All items flat
  const allItems = useMemo(() => 
    itemCategories.flatMap(cat => cat.items || []),
    [itemCategories]
  )

  // Items already selected in the active meal
  const activeMealSelectedIds = useMemo(() => {
    const meal = meals.find(m => m.id === activeMealId)
    return meal?.selectedItems.map(i => i.id) || []
  }, [meals, activeMealId])

  // Search suggestions filtered against active meal's selected items
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return allItems
      .filter(item => 
        item.name.toLowerCase().includes(query) &&
        !activeMealSelectedIds.includes(item.id)
      )
      .slice(0, 8)
  }, [searchQuery, allItems, activeMealSelectedIds])

  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Calculate total amount: sum of (guestCount per meal) * perPlatePrice
  const totalGuestCount = useMemo(() => 
    meals.reduce((sum, m) => sum + (parseInt(m.guestCount) || 0), 0),
    [meals]
  )
  const totalAmount = useMemo(() => {
    const price = parseFloat(formData.perPlatePrice) || 0
    return totalGuestCount * price
  }, [totalGuestCount, formData.perPlatePrice])

  // Meal section handlers
  const addMealSection = () => {
    const newMeal: MealSection = {
      id: `meal-${Date.now()}`,
      functionDate: meals.length > 0 ? meals[meals.length - 1].functionDate : "",
      mealType: "",
      guestCount: meals.length > 0 ? meals[meals.length - 1].guestCount : "",
      selectedItems: [],
      expanded: true
    }
    setMeals(prev => [...prev, newMeal])
    setActiveMealId(newMeal.id)
  }

  const removeMealSection = (mealId: string) => {
    if (meals.length <= 1) return
    setMeals(prev => prev.filter(m => m.id !== mealId))
    if (activeMealId === mealId) {
      setActiveMealId(meals.find(m => m.id !== mealId)?.id || "")
    }
  }

  const updateMealField = (mealId: string, field: keyof MealSection, value: any) => {
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, [field]: value } : m))
  }

  const toggleMealExpanded = (mealId: string) => {
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, expanded: !m.expanded } : m))
  }

  // Add item to active meal
  const addItemToActiveMeal = useCallback((item: Item) => {
    if (!activeMealId) return
    setMeals(prev => prev.map(m => {
      if (m.id !== activeMealId) return m
      if (m.selectedItems.find(i => i.id === item.id)) return m
      return { ...m, selectedItems: [...m.selectedItems, item] }
    }))
    setSearchQuery("")
    setShowSuggestions(false)
  }, [activeMealId])

  // Remove item from a specific meal
  const removeItemFromMeal = (mealId: string, itemId: string) => {
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      return { ...m, selectedItems: m.selectedItems.filter(i => i.id !== itemId) }
    }))
  }

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCats(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }, [])

  // Submit — creates parent event (first meal) + sub-events (additional meals)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validPhoneNumbers = phoneNumbers.filter(p => p.trim())
    
    if (!formData.organizerName || validPhoneNumbers.length === 0 || !formData.location) {
      toast({ title: "Error", description: "Please fill organizer name, phone, and location", variant: "destructive" })
      return
    }

    // Validate each meal
    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i]
      if (!meal.functionDate || !meal.mealType || !meal.guestCount) {
        toast({ title: "Error", description: `Meal ${i + 1}: Please fill date, meal type, and guest count`, variant: "destructive" })
        return
      }
      if (meal.selectedItems.length === 0) {
        toast({ title: "Error", description: `Meal ${i + 1} (${meal.mealType}): Please select at least one menu item`, variant: "destructive" })
        return
      }
    }

    setLoading(true)
    try {
      // Create parent event from the first meal
      const firstMeal = meals[0]
      const parentRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerName: formData.organizerName,
          phoneNumber: validPhoneNumbers.join(", "),
          location: formData.location,
          functionDate: firstMeal.functionDate,
          functionTime: firstMeal.mealType,
          menuCreationDate: formData.menuCreationDate,
          guestCount: firstMeal.guestCount,
          perPlatePrice: parseFloat(formData.perPlatePrice) || 0,
          totalAmount: totalAmount,
          notes: formData.notes,
          selectedItems: firstMeal.selectedItems.map(i => i.id)
        })
      })
      const parentData = await parentRes.json()
      
      if (!parentData.success) {
        throw new Error(parentData.error)
      }

      // Create sub-events for additional meals (meals[1], meals[2], etc.)
      for (let i = 1; i < meals.length; i++) {
        const meal = meals[i]
        const subRes = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizerName: formData.organizerName,
            phoneNumber: validPhoneNumbers.join(", "),
            location: formData.location,
            functionDate: meal.functionDate,
            functionTime: meal.mealType,
            menuCreationDate: formData.menuCreationDate,
            guestCount: meal.guestCount,
            perPlatePrice: 0,
            totalAmount: 0,
            notes: "",
            selectedItems: meal.selectedItems.map(i => i.id),
            parentEventId: parentData.data.id
          })
        })
        const subData = await subRes.json()
        if (!subData.success) {
          console.error(`Failed to create meal ${i + 1}:`, subData.error)
        }
      }

      toast({ title: "Success", description: `Event created with ${meals.length} meal(s)! / इवेंट बनाया गया!` })
      router.push(`/event-menu/${parentData.data.id}`)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Get the active meal's label for the item selector
  const activeMeal = meals.find(m => m.id === activeMealId)
  const activeMealLabel = activeMeal 
    ? `${MEAL_TYPES.find(mt => mt.value === activeMeal.mealType)?.label || activeMeal.mealType || "Meal"}`
    : "Select a meal"

  return (
    <div className="max-w-6xl mx-auto animate-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="flex items-center gap-2">
              <CalendarPlus className="w-8 h-8 text-primary" />
              Create Event / इवेंट बनाएं
            </h1>
            <p className="text-muted-foreground mt-1">Fill in details, add meals, and select menu items</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-medium">{formatDate(new Date())}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ========== LEFT COLUMN: Event Details ========== */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details / इवेंट विवरण</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Organizer Name / आयोजक का नाम *"
                placeholder="Enter name"
                value={formData.organizerName}
                onChange={e => handleChange("organizerName", e.target.value)}
               
              />
              
              <div>
                <label className="label mb-1.5 block flex items-center gap-2">
                  <Phone className="w-4 h-4" />Phone Numbers / फोन नंबर * (Max 4)
                </label>
                <div className="space-y-2">
                  {phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <Input type="tel" placeholder={`Phone ${index + 1}`} value={phone} onChange={e => updatePhoneNumber(index, e.target.value)} className="flex-1" />
                      {phoneNumbers.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePhoneNumber(index)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                  ))}
                  {phoneNumbers.length < 4 && (
                    <Button type="button" variant="outline" size="sm" onClick={addPhoneNumber} className="w-full"><Plus className="w-4 h-4 mr-1" />Add Number</Button>
                  )}
                </div>
              </div>
              
              <Input label="Location / स्थान *" placeholder="Enter location" value={formData.location} onChange={e => handleChange("location", e.target.value)} />

              {(
                <Input label="Menu Creation Date" type="date" value={formData.menuCreationDate} onChange={e => handleChange("menuCreationDate", e.target.value)} />
              )}

              {/* Payment — event level */}
              {(
                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Payment / भुगतान</h3>
                  <div className="space-y-3">
                    <Input label="Per Plate Price (₹)" type="number" placeholder="0" value={formData.perPlatePrice} onChange={e => handleChange("perPlatePrice", e.target.value)} />
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="font-bold text-lg text-primary flex items-center"><IndianRupee className="w-4 h-4" />{totalAmount.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{totalGuestCount} total guests × ₹{formData.perPlatePrice || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      <p className="font-medium">Advance payments → Event History page</p>
                      <p>अग्रिम भुगतान इवेंट बनने के बाद जोड़ें</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="label mb-1.5 block">Notes / नोट्स</label>
                <textarea className="input min-h-[60px] resize-none" placeholder="Special instructions" value={formData.notes} onChange={e => handleChange("notes", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* ========== RIGHT 2 COLUMNS: Meals + Menu Items ========== */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── MEAL SECTIONS ── */}
            {meals.map((meal, mealIdx) => {
              const isActive = meal.id === activeMealId
              const mealLabel = MEAL_TYPES.find(mt => mt.value === meal.mealType)?.label || `Meal ${mealIdx + 1}`
              
              return (
                <Card key={meal.id} className={cn(isActive && "ring-2 ring-primary")}>
                  {/* Meal header — click to expand/collapse and set as active */}
                  <div 
                    className="flex items-center justify-between cursor-pointer p-1"
                    onClick={() => {
                      setActiveMealId(meal.id)
                      if (!meal.expanded) toggleMealExpanded(meal.id)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-semibold">
                        {meal.mealType ? mealLabel : `Meal ${mealIdx + 1}`}
                      </span>
                      {meal.functionDate && (
                        <span className="text-xs text-muted-foreground">({formatDate(meal.functionDate)})</span>
                      )}
                      {meal.guestCount && (
                        <Badge variant="secondary" className="text-xs">{meal.guestCount} guests</Badge>
                      )}
                      <Badge variant={isActive ? "primary" : "secondary"} className="text-xs">
                        {meal.selectedItems.length} items
                      </Badge>
                      {isActive && <Badge variant="success" className="text-xs">Active</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      {meals.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); removeMealSection(meal.id) }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toggleMealExpanded(meal.id) }}>
                        {meal.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Meal content */}
                  {meal.expanded && (
                    <div className="mt-3 space-y-4">
                      {/* Meal details row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="label mb-1 block text-xs">Date / तारीख *</label>
                          <Input type="date" value={meal.functionDate} onChange={e => updateMealField(meal.id, "functionDate", e.target.value)} />
                        </div>
                        <div>
                          <label className="label mb-1 block text-xs">Meal Type *</label>
                          <Select value={meal.mealType} onValueChange={v => updateMealField(meal.id, "mealType", v)}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {MEAL_TYPES.map(mt => (<SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="label mb-1 block text-xs">Guests / मेहमान *</label>
                          <Input type="number" placeholder="0" value={meal.guestCount} onChange={e => updateMealField(meal.id, "guestCount", e.target.value)} />
                        </div>
                      </div>

                      {/* Selected items for this meal */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Selected Items ({meal.selectedItems.length})
                          {!isActive && <span className="ml-2 text-primary cursor-pointer" onClick={() => setActiveMealId(meal.id)}>← click to add items here</span>}
                        </p>
                        {meal.selectedItems.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                            {isActive ? "Use the search below to add items to this meal" : "Click this meal card to select it, then search items"}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {meal.selectedItems.map(item => (
                              <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm">
                                <span className="font-medium">{item.name}</span>
                                <button type="button" onClick={() => removeItemFromMeal(meal.id, item.id)} className="w-4 h-4 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}

            {/* Add Meal button */}
            <Button type="button" variant="outline" className="w-full border-dashed" onClick={addMealSection}>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Meal / और भोजन जोड़ें
            </Button>

            {/* ── ITEM SEARCH + BROWSE (adds to active meal) ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Add Items to: <span className="text-primary capitalize">{activeMeal?.mealType || "Select a meal"}</span>
                  </span>
                  {activeMeal?.mealType && (
                    <Badge variant="primary" className="text-xs">{activeMeal.selectedItems.length} selected</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div ref={searchRef} className="relative mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      className="input pl-10 w-full"
                      placeholder={`Search items for ${activeMeal?.mealType || "meal"}...`}
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true) }}
                      onFocus={() => setShowSuggestions(true)}
                    />
                  </div>
                  
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {suggestions.map(item => (
                        <button key={item.id} type="button" className="w-full px-4 py-3 text-left hover:bg-primary/5 flex items-center justify-between border-b last:border-b-0" onClick={() => addItemToActiveMeal(item)}>
                          <span className="font-medium">{item.name}</span>
                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {showSuggestions && searchQuery && suggestions.length === 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                      No items found for &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>

                {/* Browse by category */}
                {loadingItems ? (
                  <Loading className="min-h-[100px]" />
                ) : itemCategories.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No menu items. Add in Customize Inventory.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {itemCategories.map(cat => (
                      <div key={cat.id} className="border rounded-lg overflow-hidden">
                        <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                          <div className="flex items-center gap-2">
                            <ChevronDown className={cn("w-4 h-4 transition-transform", expandedCats.includes(cat.id) && "rotate-180")} />
                            <span className="font-medium">{cat.name}</span>
                            <span className="badge-primary">{cat.items?.length || 0}</span>
                          </div>
                        </div>
                        
                        {expandedCats.includes(cat.id) && (
                          <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {cat.items?.map(item => {
                              const isSelected = activeMealSelectedIds.includes(item.id)
                              const hasRecipe = (item.itemIngredients?.length || 0) > 0
                              return (
                                <button type="button" key={item.id} disabled={isSelected} className={cn("p-2.5 rounded-lg border text-left transition-all text-sm", isSelected ? "bg-primary/10 border-primary/30 opacity-60 cursor-not-allowed" : "hover:bg-muted hover:border-primary/50 cursor-pointer")} onClick={() => !isSelected && addItemToActiveMeal(item)}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium block">{item.name}</span>
                                      {!hasRecipe && <span className="text-xs text-amber-600">No recipe</span>}
                                    </div>
                                    {isSelected ? <Check className="w-4 h-4 text-primary shrink-0" /> : <Plus className="w-4 h-4 text-muted-foreground shrink-0" />}
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            <CalendarPlus className="w-4 h-4 mr-2" />Create Event ({meals.length} meal{meals.length !== 1 ? "s" : ""})
          </Button>
        </div>
      </form>
    </div>
  )
}