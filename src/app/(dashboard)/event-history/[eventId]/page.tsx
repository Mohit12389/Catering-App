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

  const startEditing = () => {
    if (!event) return
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

  const addPhoneNumber = () => {
    if (editFormData.phoneNumbers.length < 4) {
      setEditFormData(prev => ({ ...prev, phoneNumbers: [...prev.phoneNumbers, ""] }))
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
          guestCount,
          perPlatePrice,
          totalAmount,
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

  const editTotalAmount = useMemo(() => {
    const guests = parseInt(editFormData.guestCount) || 0
    const price = parseFloat(editFormData.perPlatePrice) || 0
    return guests * price
  }, [editFormData.guestCount, editFormData.perPlatePrice])

  const editRemainingAmount = useMemo(() => {
    const advance = parseFloat(editFormData.advancePayment) || 0
    return Math.max(0, editTotalAmount - advance)
  }, [editTotalAmount, editFormData.advancePayment])

  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event?.eventIngredients) return []
    const groups: Record<string, GroupedIngredient> = {}
    event.eventIngredients.forEach(ei => {
      if (ei.quantity <= 0) return
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
    <>
      <style>{`
        @media print {
          @page {
            margin: 0 !important;
            padding: 0 !important;
            size: auto;
          }
          html, body, main, #__next, [data-nextjs-scroll-focus-boundary] {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          * {
            box-sizing: border-box;
          }
          nav, header, footer, aside, .no-print, [class*="sidebar"], [class*="navbar"], [class*="header"] {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto print:max-w-none print:m-0 print:p-[6px] animate-in">

        {/* ===================== SCREEN ONLY HEADER ===================== */}
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
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {!isEditing ? (
                <>
                  <Button variant="outline" onClick={startEditing}><Edit className="w-4 h-4 mr-2" />Edit</Button>
                  <Button variant="outline" onClick={openCopyDialog}><Copy className="w-4 h-4 mr-2" />Copy</Button>
                  <Button variant="outline" onClick={exportCSV}><FileDown className="w-4 h-4 mr-2" />CSV</Button>
                  <Button variant="outline" onClick={printEvent}><Printer className="w-4 h-4 mr-2" />Print</Button>
                  <Button variant="destructive" onClick={deleteEvent}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
                </>
              ) : (
                <>
                  <Button onClick={saveChanges} loading={saving}><Save className="w-4 h-4 mr-2" />Save Changes</Button>
                  <Button variant="outline" onClick={cancelEditing} disabled={saving}><X className="w-4 h-4 mr-2" />Cancel</Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ===================== PRINT ONLY HEADER ===================== */}
        <div className="hidden print:block print:mb-0.5 print:pb-0.5 border-b-2 border-black" style={{ lineHeight: 1.2 }}>
          <div className="flex items-start justify-between">
            <h1 className="text-xl font-bold" style={{ margin: 0 }}>{event.organizerName}</h1>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0 text-xs text-black" style={{ marginTop: "2px" }}>
            <span>📅 {formatDate(event.functionDate)}</span>
            <span>🍽️ {event.functionTime}</span>
            <span>👥 {event.guestCount} Guests</span>
            <span>📍 {event.location}</span>
            <span>📞 {event.phoneNumber}</span>
          </div>
        </div>

        {/* ===================== SCREEN ONLY - Event Name ===================== */}
        <div className="print:hidden">
          {isEditing ? (
            <Input
              value={editFormData.organizerName}
              onChange={e => setEditFormData(prev => ({ ...prev, organizerName: e.target.value }))}
              className="text-2xl font-bold mb-6 h-auto py-2"
              placeholder="Organizer Name"
            />
          ) : (
            <h1 className="text-3xl font-bold mb-6">{event.organizerName}</h1>
          )}
        </div>

        {/* ===================== SCREEN ONLY - Two Column Layout ===================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Event Details / इवेंट विवरण</h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="label mb-1.5 block">Function Date / तारीख *</label>
                  <Input type="date" value={editFormData.functionDate} onChange={e => setEditFormData(prev => ({ ...prev, functionDate: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5 block">Meal Type / भोजन प्रकार *</label>
                  <Select value={editFormData.functionTime} onValueChange={v => setEditFormData(prev => ({ ...prev, functionTime: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select meal type" /></SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map(meal => (<SelectItem key={meal.value} value={meal.value}>{meal.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Guest Count / मेहमान *</label>
                  <Input type="number" value={editFormData.guestCount} onChange={e => setEditFormData(prev => ({ ...prev, guestCount: e.target.value }))} placeholder="Number of guests" />
                </div>
                <div>
                  <label className="label mb-1.5 block flex items-center gap-2">
                    <Phone className="w-4 h-4" />Phone Numbers / फोन नंबर * (Max 4)
                  </label>
                  <div className="space-y-2">
                    {editFormData.phoneNumbers.map((phone, index) => (
                      <div key={index} className="flex gap-2">
                        <Input type="tel" placeholder={`Phone ${index + 1}`} value={phone} onChange={e => updatePhoneNumber(index, e.target.value)} className="flex-1" />
                        {editFormData.phoneNumbers.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePhoneNumber(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {editFormData.phoneNumbers.length < 4 && (
                      <Button type="button" variant="outline" size="sm" onClick={addPhoneNumber} className="w-full">
                        <Plus className="w-4 h-4 mr-1" />Add Another Number
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label mb-1.5 block">Location / स्थान</label>
                  <Input value={editFormData.location} onChange={e => setEditFormData(prev => ({ ...prev, location: e.target.value }))} placeholder="Event location" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Notes / नोट्स</label>
                  <textarea className="input min-h-[80px] resize-none w-full" value={editFormData.notes} onChange={e => setEditFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Any special instructions" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div><p className="text-sm text-muted-foreground">Function Date</p><p className="font-medium">{formatDate(event.functionDate)}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div><p className="text-sm text-muted-foreground">Meal Type</p><p className="font-medium capitalize">{event.functionTime}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div><p className="text-sm text-muted-foreground">Guest Count</p><p className="font-medium">{event.guestCount} Guests</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div><p className="text-sm text-muted-foreground">Phone Number</p><p className="font-medium">{event.phoneNumber}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{event.location}</p></div>
                </div>
                {event.menuCreationDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div><p className="text-sm text-muted-foreground">Menu Creation Date</p><p className="font-medium">{formatDate(event.menuCreationDate)}</p></div>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-medium mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Payment Details / भुगतान</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label mb-1.5 block">Per Plate Price (₹)</label>
                      <Input type="number" value={editFormData.perPlatePrice} onChange={e => setEditFormData(prev => ({ ...prev, perPlatePrice: e.target.value }))} placeholder="0" />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Advance Payment (₹)</label>
                      <Input type="number" value={editFormData.advancePayment} onChange={e => setEditFormData(prev => ({ ...prev, advancePayment: e.target.value }))} placeholder="0" />
                    </div>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Amount</span>
                      <span className="font-bold text-lg text-primary flex items-center"><IndianRupee className="w-4 h-4" />{editTotalAmount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{editFormData.guestCount || 0} guests × ₹{editFormData.perPlatePrice || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Remaining</span>
                      <span className="font-semibold text-lg text-amber-600 flex items-center"><IndianRupee className="w-4 h-4" />{editRemainingAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Plate Price</span>
                    <span className="font-medium flex items-center"><IndianRupee className="w-3 h-3" />{(event.perPlatePrice || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-medium flex items-center"><IndianRupee className="w-3 h-3" />{(event.totalAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Advance Paid</span>
                    <span className="font-medium text-green-600 flex items-center"><IndianRupee className="w-3 h-3" />{(event.advancePayment || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-medium">Remaining</span>
                    <span className="font-semibold text-amber-600 flex items-center"><IndianRupee className="w-3 h-3" />{((event.totalAmount || 0) - (event.advancePayment || 0)).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-2">Menu Items / मेन्यू आइटम</h2>
            <p className="text-sm text-muted-foreground mb-4">{event.eventItems?.length || 0} items</p>
            <div className="grid grid-cols-2 gap-2">
              {event.eventItems?.map(ei => (
                <div key={ei.id} className="ingredient-card">
                  <ChefHat className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{ei.item?.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ===================== PRINT ONLY - Menu Items ===================== */}
        <div className="hidden print:block" style={{ marginTop: "3px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px", borderBottom: "1px solid #d1d5db", paddingBottom: "1px" }}>
            Menu Items 
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0px",
            border: "1px solid #e5e7eb",
            borderRadius: "3px",
            overflow: "hidden"
          }}>
            {event.eventItems?.map(ei => (
              <div
                key={ei.id}
                style={{
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                  fontSize: "12px",
                  lineHeight: "1.15",
                  padding: "1px 4px",
                  borderRight: "1px solid #e5e7eb",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                {ei.item?.name}
              </div>
            ))}
          </div>
        </div>

        {/* ===================== SCREEN ONLY - Ingredients ===================== */}
        {groupedIngredients.length > 0 && (
          <Card className="mt-6 print:hidden">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-secondary" />
              <h2 className="text-lg font-semibold">Ingredients List / सामग्री सूची</h2>
              <Badge variant="success">{totalIngredients} items</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {groupedIngredients.flatMap(group =>
                group.ingredients.map(ing => (
                  <div key={ing.id} className="ingredient-card">
                    <span className="font-medium truncate mr-1">{ing.name}</span>
                    <span className="text-primary font-semibold whitespace-nowrap">{ing.quantity} {ing.unit}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* ===================== PRINT ONLY - Ingredients ===================== */}
        {groupedIngredients.length > 0 && (
          <div className="hidden print:block" style={{ marginTop: "3px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px", borderBottom: "1px solid #d1d5db", paddingBottom: "1px" }}>
              Ingredients 
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "2px 0px",
              border: "1px solid black",
              borderRadius: "4px",
              overflow: "hidden"
            }}>
              {groupedIngredients.flatMap(group =>
                group.ingredients.map(ing => (
                  <div
                    key={ing.id}
                    style={{
                      breakInside: "avoid",
                      pageBreakInside: "avoid",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "12px",
                      padding: "1px 4px",
                      borderRight: "1px solid black",
                      borderBottom: "1px solid black",
                      gap: "2px",
                      minWidth: 0
                    }}
                  >
                    <span style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {ing.name}
                    </span>
                    <span style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      color: "#1f2937"
                    }}>
                      {ing.quantity} {ing.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== SCREEN ONLY - Notes ===================== */}
        {!isEditing && event.notes && (
          <Card className="mt-6 print:hidden">
            <h2 className="text-lg font-semibold mb-2">Notes / नोट्स</h2>
            <p className="text-muted-foreground">{event.notes}</p>
          </Card>
        )}

        {/* ===================== PRINT ONLY - Notes ===================== */}
        {event.notes && (
          <div className="hidden print:block" style={{ marginTop: "2px", fontSize: "10px" }}>
            <span className="font-semibold">Notes:</span> {event.notes}
          </div>
        )}


        {/* ===================== Copy Event Dialog ===================== */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5" />Copy Event / इवेंट कॉपी करें
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Create a new event with the same menu items and ingredients.
              <br /><span className="text-xs">समान मेन्यू और सामग्री के साथ नया इवेंट बनाएं।</span>
            </p>
            <div className="space-y-4">
              <Input label="Organizer Name / आयोजक का नाम *" placeholder="Enter new organizer name" value={copyFormData.organizerName} onChange={e => setCopyFormData(prev => ({ ...prev, organizerName: e.target.value }))} />
              <Input label="Phone Number / फोन नंबर *" type="tel" placeholder="Enter phone number" value={copyFormData.phoneNumber} onChange={e => setCopyFormData(prev => ({ ...prev, phoneNumber: e.target.value }))} />
              <Input label="Location / स्थान" placeholder="Enter location" value={copyFormData.location} onChange={e => setCopyFormData(prev => ({ ...prev, location: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Function Date / तारीख *" type="date" value={copyFormData.functionDate} onChange={e => setCopyFormData(prev => ({ ...prev, functionDate: e.target.value }))} />
                <div>
                  <label className="label mb-1.5 block">Meal Type / भोजन प्रकार *</label>
                  <Select value={copyFormData.functionTime} onValueChange={v => setCopyFormData(prev => ({ ...prev, functionTime: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select meal type" /></SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map(meal => (<SelectItem key={meal.value} value={meal.value}>{meal.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Guest Count / मेहमान" type="number" value={copyFormData.guestCount} onChange={e => setCopyFormData(prev => ({ ...prev, guestCount: e.target.value }))} />
                <Input label="Per Plate Price (₹)" type="number" value={copyFormData.perPlatePrice} onChange={e => setCopyFormData(prev => ({ ...prev, perPlatePrice: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCopyEvent} loading={copying}><Copy className="w-4 h-4 mr-2" />Create Copy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </>
  )
}