"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  CalendarPlus, 
  ChevronDown,
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

export default function CreateEventPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  
  const { data: itemCategories = [], isLoading: loadingItems } = useSWRFetch<ItemCategory[]>('/api/categories/items')
  
  // ← CHANGED: Removed advancePayment from form state
  const [formData, setFormData] = useState({
    organizerName: "",
    location: "",
    functionDate: "",
    mealType: "",
    menuCreationDate: new Date().toISOString().split('T')[0],
    guestCount: "",
    perPlatePrice: "",
    notes: ""
  })
  
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([""])
  const [selectedItems, setSelectedItems] = useState<Item[]>([])

  const addPhoneNumber = () => {
    if (phoneNumbers.length < 4) {
      setPhoneNumbers([...phoneNumbers, ""])
    }
  }

  const removePhoneNumber = (index: number) => {
    if (phoneNumbers.length > 1) {
      setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index))
    }
  }

  const updatePhoneNumber = (index: number, value: string) => {
    const newPhones = [...phoneNumbers]
    newPhones[index] = value
    setPhoneNumbers(newPhones)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const allItems = useMemo(() => 
    itemCategories.flatMap(cat => cat.items || []),
    [itemCategories]
  )

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return allItems
      .filter(item => 
        item.name.toLowerCase().includes(query) &&
        !selectedItems.find(s => s.id === item.id)
      )
      .slice(0, 8)
  }, [searchQuery, allItems, selectedItems])

  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const totalAmount = useMemo(() => {
    const guests = parseInt(formData.guestCount) || 0
    const price = parseFloat(formData.perPlatePrice) || 0
    return guests * price
  }, [formData.guestCount, formData.perPlatePrice])

  // ← REMOVED: remainingPayment calculation (no longer needed without advance field)

  const addItem = useCallback((item: Item) => {
    setSelectedItems(prev => {
      if (prev.find(i => i.id === item.id)) return prev
      return [...prev, item]
    })
    setSearchQuery("")
    setShowSuggestions(false)
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCats(prev => 
      prev.includes(catId) 
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validPhoneNumbers = phoneNumbers.filter(p => p.trim())
    
    if (!formData.organizerName || validPhoneNumbers.length === 0 || !formData.location || 
        !formData.functionDate || !formData.mealType || !formData.guestCount) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" })
      return
    }

    if (selectedItems.length === 0) {
      toast({ title: "Error", description: "Please select at least one menu item", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData,
          functionTime: formData.mealType,
          phoneNumber: validPhoneNumbers.join(", "),
          selectedItems: selectedItems.map(i => i.id),
          perPlatePrice: parseFloat(formData.perPlatePrice) || 0,
          totalAmount: totalAmount
          // ← REMOVED: advancePayment no longer sent during event creation
          // Advance payments are managed through installments on the event history page
        })
      })
      const data = await res.json()
      
      if (data.success) {
        toast({ title: "Success", description: "Event created! / इवेंट बनाया गया!" })
        router.push(`/event-menu/${data.data.id}`)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const selectedItemIds = selectedItems.map(i => i.id)

  return (
    <div className="max-w-6xl mx-auto animate-in">
      {/* Header with Date */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="flex items-center gap-2">
              <CalendarPlus className="w-8 h-8 text-primary" />
              Create Event / इवेंट बनाएं
            </h1>
            <p className="text-muted-foreground mt-1">
              Fill in the details and select menu items for the event
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-medium">{formatDate(new Date())}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details / इवेंट विवरण</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Organizer Name / आयोजक का नाम *"
                placeholder="Enter name / नाम दर्ज करें"
                value={formData.organizerName}
                onChange={e => handleChange("organizerName", e.target.value)}
              />
              
              {/* Multiple Phone Numbers */}
              <div>
                <label className="label mb-1.5 block flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Numbers / फोन नंबर * (Max 4)
                </label>
                <div className="space-y-2">
                  {phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder={`Phone ${index + 1}`}
                        value={phone}
                        onChange={e => updatePhoneNumber(index, e.target.value)}
                        className="flex-1"
                      />
                      {phoneNumbers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePhoneNumber(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {phoneNumbers.length < 4 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPhoneNumber}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Another Number
                    </Button>
                  )}
                </div>
              </div>
              
              <Input
                label="Location / स्थान *"
                placeholder="Enter location / स्थान दर्ज करें"
                value={formData.location}
                onChange={e => handleChange("location", e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Function Date / तारीख *"
                  type="date"
                  value={formData.functionDate}
                  onChange={e => handleChange("functionDate", e.target.value)}
                />
                
                <div>
                  <label className="label mb-1.5 block">Meal Type / भोजन प्रकार *</label>
                  <Select value={formData.mealType} onValueChange={v => handleChange("mealType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select meal type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map(meal => (
                        <SelectItem key={meal.value} value={meal.value}>{meal.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Input
                label="Menu Creation Date / मेन्यू बनाने की तारीख"
                type="date"
                value={formData.menuCreationDate}
                onChange={e => handleChange("menuCreationDate", e.target.value)}
              />
              
              <Input
                label="Guest Count / मेहमानों की संख्या *"
                type="number"
                placeholder="Enter number of guests"
                value={formData.guestCount}
                onChange={e => handleChange("guestCount", e.target.value)}
              />

              {/* ← CHANGED: Payment Section - removed advance payment, just shows total */}
              <div className="pt-4 border-t">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment Details / भुगतान विवरण
                </h3>
                
                <div className="space-y-3">
                  <Input
                    label="Per Plate Price / प्रति प्लेट कीमत (₹)"
                    type="number"
                    placeholder="0"
                    value={formData.perPlatePrice}
                    onChange={e => handleChange("perPlatePrice", e.target.value)}
                  />
                  
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Amount / कुल राशि</span>
                      <span className="font-bold text-lg text-primary flex items-center">
                        <IndianRupee className="w-4 h-4" />
                        {totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.guestCount || 0} guests × ₹{formData.perPlatePrice || 0}
                    </p>
                  </div>

                  {/* ← NEW: Info box explaining where to add advance payments */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    <p className="font-medium">Advance payments can be added after event creation</p>
                    <p className="mt-0.5">Go to Event History → select event → Add Payment</p>
                    <p>अग्रिम भुगतान इवेंट बनने के बाद जोड़ें</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="label mb-1.5 block">Notes / नोट्स</label>
                <textarea
                  className="input min-h-[60px] resize-none"
                  placeholder="Any special instructions / कोई विशेष निर्देश"
                  value={formData.notes}
                  onChange={e => handleChange("notes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Column 2 & 3: Menu Items Selection */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search Box with Autocomplete */}
            <Card>
              <CardHeader>
                <CardTitle>Search Menu Items / मेन्यू खोजें</CardTitle>
              </CardHeader>
              <CardContent>
                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      className="input pl-10 w-full"
                      placeholder="Type to search... (e.g., 'pan' for paneer)"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        setShowSuggestions(true)
                      }}
                      onFocus={() => setShowSuggestions(true)}
                    />
                  </div>
                  
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {suggestions.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-primary/5 flex items-center justify-between border-b last:border-b-0"
                          onClick={() => addItem(item)}
                        >
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
              </CardContent>
            </Card>

            {/* Selected Items Box */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Selected Items / चयनित आइटम</span>
                  <Badge variant="primary">{selectedItems.length} selected</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No items selected</p>
                    <p className="text-sm">Search or select items from below / नीचे से आइटम चुनें</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedItems.map(item => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-full"
                      >
                        <span className="text-sm font-medium">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="w-5 h-5 rounded-full bg-primary/20 hover:bg-destructive hover:text-white flex items-center justify-center transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Items Box */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Available Menu Items / उपलब्ध मेन्यू आइटम</span>
                  <Badge variant="secondary">{allItems.length} items</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingItems ? (
                  <Loading className="min-h-[200px]" />
                ) : itemCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No menu items available</p>
                    <p className="text-sm">Add items in Customize Inventory</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
                          <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {cat.items?.map(item => {
                              const isSelected = selectedItemIds.includes(item.id)
                              const hasRecipe = (item.itemIngredients?.length || 0) > 0
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  disabled={isSelected}
                                  className={cn(
                                    "p-3 rounded-lg border text-left transition-all",
                                    isSelected 
                                      ? "bg-primary/10 border-primary/30 opacity-60 cursor-not-allowed"
                                      : "hover:bg-muted hover:border-primary/50 cursor-pointer"
                                  )}
                                  onClick={() => !isSelected && addItem(item)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-sm block">{item.name}</span>
                                      {!hasRecipe && (
                                        <span className="text-xs text-amber-600">No recipe</span>
                                      )}
                                    </div>
                                    {isSelected ? (
                                      <Check className="w-4 h-4 text-primary shrink-0" />
                                    ) : (
                                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            <CalendarPlus className="w-4 h-4 mr-2" />
            Create Event / इवेंट बनाएं
          </Button>
        </div>
      </form>
    </div>
  )
}