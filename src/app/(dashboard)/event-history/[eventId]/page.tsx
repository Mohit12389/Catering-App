"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Phone,
  MapPin,
  ChefHat,
  FileDown,
  Printer,
  Trash2,
  Package,
  CalendarCheck,
  IndianRupee,
  CreditCard,
  Copy,
  Edit,
  Save,
  X,
  Plus
} from "lucide-react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Card, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event } from "@/types"
import { formatDate } from "@/lib/utils"

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
  ingredients: {
    id: string
    name: string
    unit: string
    quantity: number
  }[]
}

export default function EventHistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editFormData, setEditFormData] = useState({
    organizerName: "",
    phoneNumbers: [""],
    location: "",
    functionDate: "",
    functionTime: "",
    guestCount: "",
    perPlatePrice: "",
    advancePayment: "",
    notes: ""
  })
  
  // Copy event dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyFormData, setCopyFormData] = useState({
    organizerName: "",
    phoneNumber: "",
    location: "",
    functionDate: "",
    functionTime: "",
    guestCount: "",
    perPlatePrice: ""
  })

  useEffect(() => {
    fetchEvent()
  }, [params.eventId])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}`)
      const data = await res.json()
      if (data.success) setEvent(data.data)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load event", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    if (!event) return
    
    // Parse phone numbers (they might be comma-separated)
    const phones = event.phoneNumber ? event.phoneNumber.split(",").map(p => p.trim()) : [""]
    
    setEditFormData({
      organizerName: event.organizerName || "",
      phoneNumbers: phones.length > 0 ? phones : [""],
      location: event.location || "",
      functionDate: event.functionDate ? new Date(event.functionDate).toISOString().split('T')[0] : "",
      functionTime: event.functionTime || "",
      guestCount: String(event.guestCount || ""),
      perPlatePrice: String(event.perPlatePrice || ""),
      advancePayment: String(event.advancePayment || ""),
      notes: event.notes || ""
    })
    setIsEditing(true)
  }

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false)
    setEditFormData({
      organizerName: "",
      phoneNumbers: [""],
      location: "",
      functionDate: "",
      functionTime: "",
      guestCount: "",
      perPlatePrice: "",
      advancePayment: "",
      notes: ""
    })
  }

  // Phone number handlers
  const addPhoneNumber = () => {
    if (editFormData.phoneNumbers.length < 4) {
      setEditFormData(prev => ({
        ...prev,
        phoneNumbers: [...prev.phoneNumbers, ""]
      }))
    }
  }

  const removePhoneNumber = (index: number) => {
    if (editFormData.phoneNumbers.length > 1) {
      setEditFormData(prev => ({
        ...prev,
        phoneNumbers: prev.phoneNumbers.filter((_, i) => i !== index)
      }))
    }
  }

  const updatePhoneNumber = (index: number, value: string) => {
    setEditFormData(prev => {
      const newPhones = [...prev.phoneNumbers]
      newPhones[index] = value
      return { ...prev, phoneNumbers: newPhones }
    })
  }

  // Save changes
  const saveChanges = async () => {
    if (!event) return
    
    const validPhoneNumbers = editFormData.phoneNumbers.filter(p => p.trim())
    
    if (!editFormData.organizerName || validPhoneNumbers.length === 0 || !editFormData.functionDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const guestCount = parseInt(editFormData.guestCount) || 0
      const perPlatePrice = parseFloat(editFormData.perPlatePrice) || 0
      const totalAmount = guestCount * perPlatePrice

      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerName: editFormData.organizerName,
          phoneNumber: validPhoneNumbers.join(", "),
          location: editFormData.location,
          functionDate: editFormData.functionDate,
          functionTime: editFormData.functionTime,
          guestCount: guestCount,
          perPlatePrice: perPlatePrice,
          totalAmount: totalAmount,
          advancePayment: parseFloat(editFormData.advancePayment) || 0,
          notes: editFormData.notes
        })
      })
      
      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        setIsEditing(false)
        toast({ title: "Success", description: "Event updated successfully!" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Calculate total for edit form
  const editTotalAmount = useMemo(() => {
    const guests = parseInt(editFormData.guestCount) || 0
    const price = parseFloat(editFormData.perPlatePrice) || 0
    return guests * price
  }, [editFormData.guestCount, editFormData.perPlatePrice])

  const editRemainingAmount = useMemo(() => {
    const advance = parseFloat(editFormData.advancePayment) || 0
    return Math.max(0, editTotalAmount - advance)
  }, [editTotalAmount, editFormData.advancePayment])

  // Group ingredients by category
  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event?.eventIngredients) return []
    
    const groups: Record<string, GroupedIngredient> = {}
    
    event.eventIngredients.forEach(ei => {
      if (ei.quantity <= 0) return // Skip zero quantity
      
      const catId = ei.ingredient?.category?.id || "uncategorized"
      const catName = ei.ingredient?.category?.name || "Other"
      
      if (!groups[catId]) {
        groups[catId] = { categoryId: catId, categoryName: catName, ingredients: [] }
      }
      
      groups[catId].ingredients.push({
        id: ei.id,
        name: ei.ingredient?.name || "Unknown",
        unit: ei.ingredient?.unit || "",
        quantity: ei.quantity
      })
    })
    
    Object.values(groups).forEach(g => g.ingredients.sort((a, b) => a.name.localeCompare(b.name)))
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [event?.eventIngredients])

  const totalIngredients = groupedIngredients.reduce((sum, g) => sum + g.ingredients.length, 0)

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        toast({ title: "Success", description: `Status updated to ${newStatus}` })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const deleteEvent = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return
    try {
      const res = await fetch(`/api/events/${params.eventId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Success", description: "Event deleted" })
        router.push("/event-history")
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" })
    }
  }

  const openCopyDialog = () => {
    if (!event) return
    setCopyFormData({
      organizerName: "",
      phoneNumber: "",
      location: event.location,
      functionDate: "",
      functionTime: event.functionTime,
      guestCount: String(event.guestCount),
      perPlatePrice: String(event.perPlatePrice || "")
    })
    setCopyDialogOpen(true)
  }

  const handleCopyEvent = async () => {
    if (!event) return
    
    if (!copyFormData.organizerName || !copyFormData.phoneNumber || !copyFormData.functionDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" })
      return
    }
    
    setCopying(true)
    try {
      const res = await fetch("/api/events/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEventId: event.id,
          ...copyFormData,
          guestCount: parseInt(copyFormData.guestCount) || event.guestCount,
          perPlatePrice: parseFloat(copyFormData.perPlatePrice) || 0
        })
      })
      
      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: "Event copied successfully!" })
        setCopyDialogOpen(false)
        router.push(`/event-menu/${data.data.id}`)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setCopying(false)
    }
  }

  const exportCSV = () => {
    if (!event) return
    let csv = "Category,Ingredient,Quantity,Unit\n"
    groupedIngredients.forEach(g => {
      g.ingredients.forEach(ing => {
        csv += `"${g.categoryName}","${ing.name}",${ing.quantity},"${ing.unit}"\n`
      })
    })
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${event.eventId}-ingredients.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast({ title: "Success", description: "CSV exported" })
  }

  const printEvent = () => window.print()

  if (loading) return <Loading text="Loading event..." />

  if (!event) {
    return (
      <div className="empty-state">
        <p>Event not found</p>
        <Button onClick={() => router.push("/event-history")} className="mt-4">Back to History</Button>
      </div>
    )
  }

  const statusColors: Record<string, 'success' | 'warning' | 'destructive'> = {
    active: "success",
    completed: "primary" as any,
    cancelled: "destructive"
  }

  return (
    <div className="max-w-5xl mx-auto print:max-w-none animate-in">
      {/* Header - Hide on print */}
      <div className="no-print">
        <Button variant="ghost" onClick={() => router.push("/event-history")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to History
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Badge variant="primary" className="font-mono">{event.eventId}</Badge>
            <Badge variant={statusColors[event.status] || "warning"}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={event.status} onValueChange={updateStatus} disabled={updating || isEditing}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            {!isEditing ? (
              <>
                <Button variant="outline" onClick={startEditing}>
                  <Edit className="w-4 h-4 mr-2" />Edit
                </Button>
                <Button variant="outline" onClick={openCopyDialog}><Copy className="w-4 h-4 mr-2" />Copy</Button>
                <Button variant="outline" onClick={exportCSV}><FileDown className="w-4 h-4 mr-2" />CSV</Button>
                <Button variant="outline" onClick={printEvent}><Printer className="w-4 h-4 mr-2" />Print</Button>
                <Button variant="destructive" onClick={deleteEvent}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
              </>
            ) : (
              <>
                <Button onClick={saveChanges} loading={saving}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                  <X className="w-4 h-4 mr-2" />Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-2 border-b pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Anchal Caterers</h1>
            <p className="text-xs text-muted-foreground">Event Details</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs">{event.eventId}</p>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Event Name */}
      {isEditing ? (
        <Input
          value={editFormData.organizerName}
          onChange={e => setEditFormData(prev => ({ ...prev, organizerName: e.target.value }))}
          className="text-2xl font-bold mb-6 h-auto py-2"
          placeholder="Organizer Name"
        />
      ) : (
        <h1 className="text-3xl font-bold mb-6 print:text-xl print:mb-2">{event.organizerName}</h1>
      )}

      {/* Two Column Layout on desktop, Single Column for print */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-2">
        {/* Event Details */}
        <Card className="print:p-2">
          <h2 className="text-lg font-semibold mb-4 print:text-sm print:mb-1">Event Details / इवेंट विवरण</h2>
          
          {isEditing ? (
            // Edit Mode
            <div className="space-y-4">
              {/* Function Date */}
              <div>
                <label className="label mb-1.5 block">Function Date / तारीख *</label>
                <Input
                  type="date"
                  value={editFormData.functionDate}
                  onChange={e => setEditFormData(prev => ({ ...prev, functionDate: e.target.value }))}
                />
              </div>

              {/* Meal Type */}
              <div>
                <label className="label mb-1.5 block">Meal Type / भोजन प्रकार *</label>
                <Select 
                  value={editFormData.functionTime} 
                  onValueChange={v => setEditFormData(prev => ({ ...prev, functionTime: v }))}
                >
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

              {/* Guest Count */}
              <div>
                <label className="label mb-1.5 block">Guest Count / मेहमान *</label>
                <Input
                  type="number"
                  value={editFormData.guestCount}
                  onChange={e => setEditFormData(prev => ({ ...prev, guestCount: e.target.value }))}
                  placeholder="Number of guests"
                />
              </div>

              {/* Phone Numbers */}
              <div>
                <label className="label mb-1.5 block flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Numbers / फोन नंबर * (Max 4)
                </label>
                <div className="space-y-2">
                  {editFormData.phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder={`Phone ${index + 1}`}
                        value={phone}
                        onChange={e => updatePhoneNumber(index, e.target.value)}
                        className="flex-1"
                      />
                      {editFormData.phoneNumbers.length > 1 && (
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
                  {editFormData.phoneNumbers.length < 4 && (
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

              {/* Location */}
              <div>
                <label className="label mb-1.5 block">Location / स्थान</label>
                <Input
                  value={editFormData.location}
                  onChange={e => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Event location"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="label mb-1.5 block">Notes / नोट्स</label>
                <textarea
                  className="input min-h-[80px] resize-none w-full"
                  value={editFormData.notes}
                  onChange={e => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any special instructions"
                />
              </div>
            </div>
          ) : (
            // View Mode
            <div className="space-y-4 print:space-y-0 print:text-xs print:grid print:grid-cols-3 print:gap-x-4 print:gap-y-1">
              <div className="flex items-start gap-3 print:gap-1">
                <Calendar className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                <div>
                  <p className="text-sm print:text-[10px] text-muted-foreground">Function Date</p>
                  <p className="font-medium print:text-xs">{formatDate(event.functionDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 print:gap-1">
                <Clock className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                <div>
                  <p className="text-sm print:text-[10px] text-muted-foreground">Meal Type</p>
                  <p className="font-medium print:text-xs capitalize">{event.functionTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 print:gap-1">
                <Users className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                <div>
                  <p className="text-sm print:text-[10px] text-muted-foreground">Guest Count</p>
                  <p className="font-medium print:text-xs">{event.guestCount} Guests</p>
                </div>
              </div>
              <div className="flex items-start gap-3 print:gap-1">
                <Phone className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                <div>
                  <p className="text-sm print:text-[10px] text-muted-foreground">Phone Number</p>
                  <p className="font-medium print:text-xs">{event.phoneNumber}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 print:gap-1">
                <MapPin className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                <div>
                  <p className="text-sm print:text-[10px] text-muted-foreground">Location</p>
                  <p className="font-medium print:text-xs">{event.location}</p>
                </div>
              </div>
              {event.menuCreationDate && (
                <div className="flex items-start gap-3 print:gap-1">
                  <Calendar className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                  <div>
                    <p className="text-sm print:text-[10px] text-muted-foreground">Menu Creation Date</p>
                    <p className="font-medium print:text-xs">{formatDate(event.menuCreationDate)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Info */}
          <div className="mt-4 pt-4 border-t no-print">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment Details / भुगतान
            </h3>
            
            {isEditing ? (
              // Edit Payment
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1.5 block">Per Plate Price (₹)</label>
                    <Input
                      type="number"
                      value={editFormData.perPlatePrice}
                      onChange={e => setEditFormData(prev => ({ ...prev, perPlatePrice: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Advance Payment (₹)</label>
                    <Input
                      type="number"
                      value={editFormData.advancePayment}
                      onChange={e => setEditFormData(prev => ({ ...prev, advancePayment: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-lg text-primary flex items-center">
                      <IndianRupee className="w-4 h-4" />
                      {editTotalAmount.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {editFormData.guestCount || 0} guests × ₹{editFormData.perPlatePrice || 0}
                  </p>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <span className="font-semibold text-lg text-amber-600 flex items-center">
                      <IndianRupee className="w-4 h-4" />
                      {editRemainingAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // View Payment
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per Plate Price</span>
                  <span className="font-medium flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {(event.perPlatePrice || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {(event.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Paid</span>
                  <span className="font-medium text-green-600 flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {(event.advancePayment || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Remaining</span>
                  <span className="font-semibold text-amber-600 flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {((event.totalAmount || 0) - (event.advancePayment || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Menu Items */}
        <Card className="print:p-2">
          <h2 className="text-lg font-semibold mb-2 print:text-sm print:mb-1">Menu Items / मेन्यू आइटम</h2>
          <p className="text-sm text-muted-foreground mb-4 print:mb-1 print:text-xs">{event.eventItems?.length || 0} items</p>
          <div className="grid grid-cols-2 gap-2 print:grid-cols-4 print:gap-1">
            {event.eventItems?.map(ei => (
              <div key={ei.id} className="ingredient-card print:p-1 print:text-[10px]">
                <ChefHat className="w-4 h-4 text-primary shrink-0 print:w-2 print:h-2" />
                <span className="font-medium truncate">{ei.item?.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ingredients List - Grouped by Category with Compact Grid */}
      {groupedIngredients.length > 0 && (
        <Card className="mt-6 print:mt-2 print:p-2">
          <div className="flex items-center gap-2 mb-4 print:mb-1">
            <Package className="w-5 h-5 text-secondary print:w-3 print:h-3" />
            <h2 className="text-lg font-semibold print:text-sm">Ingredients List / सामग्री सूची</h2>
            <Badge variant="success" className="print:text-[10px] print:px-1">{totalIngredients} items</Badge>
          </div>

          <div className="space-y-5 print:space-y-1">
            {groupedIngredients.map(group => (
              <div key={group.categoryId}>
                <div className="flex items-center gap-2 mb-3 print:mb-1">
                  <span className="font-semibold text-muted-foreground print:text-xs">→ {group.categoryName}</span>
                  <Badge variant="secondary" className="print:text-[10px] print:px-1">{group.ingredients.length}</Badge>
                </div>
                
                <div className="grid-4 print:grid-cols-5 print:gap-1">
                  {group.ingredients.map(ing => (
                    <div key={ing.id} className="ingredient-card print:p-1 print:text-[10px]">
                      <span className="font-medium truncate mr-1">{ing.name}</span>
                      <span className="text-primary font-semibold whitespace-nowrap">
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes - View Mode Only */}
      {!isEditing && event.notes && (
        <Card className="mt-6 print:mt-2 print:p-2">
          <h2 className="text-lg font-semibold mb-2 print:text-sm print:mb-1">Notes / नोट्स</h2>
          <p className="text-muted-foreground print:text-xs">{event.notes}</p>
        </Card>
      )}

      {/* Print Footer */}
      <div className="hidden print:block mt-4 pt-2 border-t text-center text-xs text-muted-foreground">
        <p>Generated by Anchal Caterers Management System</p>
        <p>Printed on {new Date().toLocaleString()}</p>
      </div>

      {/* Copy Event Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Copy Event / इवेंट कॉपी करें
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground mb-4">
            Create a new event with the same menu items and ingredients.
            <br />
            <span className="text-xs">समान मेन्यू और सामग्री के साथ नया इवेंट बनाएं।</span>
          </p>

          <div className="space-y-4">
            <Input
              label="Organizer Name / आयोजक का नाम *"
              placeholder="Enter new organizer name"
              value={copyFormData.organizerName}
              onChange={e => setCopyFormData(prev => ({ ...prev, organizerName: e.target.value }))}
            />
            
            <Input
              label="Phone Number / फोन नंबर *"
              type="tel"
              placeholder="Enter phone number"
              value={copyFormData.phoneNumber}
              onChange={e => setCopyFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
            />
            
            <Input
              label="Location / स्थान"
              placeholder="Enter location"
              value={copyFormData.location}
              onChange={e => setCopyFormData(prev => ({ ...prev, location: e.target.value }))}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Function Date / तारीख *"
                type="date"
                value={copyFormData.functionDate}
                onChange={e => setCopyFormData(prev => ({ ...prev, functionDate: e.target.value }))}
              />
              
              <div>
                <label className="label mb-1.5 block">Meal Type / भोजन प्रकार *</label>
                <Select 
                  value={copyFormData.functionTime} 
                  onValueChange={v => setCopyFormData(prev => ({ ...prev, functionTime: v }))}
                >
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
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Guest Count / मेहमान"
                type="number"
                value={copyFormData.guestCount}
                onChange={e => setCopyFormData(prev => ({ ...prev, guestCount: e.target.value }))}
              />
              
              <Input
                label="Per Plate Price (₹)"
                type="number"
                value={copyFormData.perPlatePrice}
                onChange={e => setCopyFormData(prev => ({ ...prev, perPlatePrice: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCopyEvent} loading={copying}>
              <Copy className="w-4 h-4 mr-2" />
              Create Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}