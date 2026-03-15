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
  Plus,
  Banknote  // ← NEW: icon for advance payments
} from "lucide-react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Card, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event, AdvancePayment } from "@/types"  // ← NEW: import AdvancePayment type
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

  // ==========================================
  // NEW: Advance Payment (Installment) State
  // ==========================================
  const [showAddPayment, setShowAddPayment] = useState(false)       // toggle add form
  const [newPaymentAmount, setNewPaymentAmount] = useState("")       // amount input
  const [newPaymentDate, setNewPaymentDate] = useState("")           // date input
  const [newPaymentNotes, setNewPaymentNotes] = useState("")         // notes input
  const [addingPayment, setAddingPayment] = useState(false)          // loading state
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null) // which payment is being deleted

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
          // NOTE: advancePayment is no longer editable directly in edit mode
          // It's managed through the installments section
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

  // ← CHANGED: remaining now uses event.advancePayment (which is the sum of installments)
  const editRemainingAmount = useMemo(() => {
    const advance = event?.advancePayment || 0
    return Math.max(0, editTotalAmount - advance)
  }, [editTotalAmount, event?.advancePayment])

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

  // ==========================================
  // NEW: Add Advance Payment Handler
  // ==========================================
  const handleAddAdvancePayment = async () => {
    if (!event) return
    const amount = parseFloat(newPaymentAmount)
    if (!amount || amount <= 0 || !newPaymentDate) {
      toast({ title: "Error", description: "Enter a valid amount and date", variant: "destructive" })
      return
    }

    setAddingPayment(true)
    try {
      const res = await fetch("/api/advance-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          amount,
          paidDate: newPaymentDate,
          notes: newPaymentNotes.trim() || null
        })
      })
      const data = await res.json()
      if (data.success) {
        // Refresh event to get updated advancePayment total and installments list
        await fetchEvent()
        // Reset form
        setNewPaymentAmount("")
        setNewPaymentDate("")
        setNewPaymentNotes("")
        setShowAddPayment(false)
        toast({ title: "Payment Added / भुगतान जोड़ा गया", description: `₹${amount.toLocaleString()} recorded` })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingPayment(false)
    }
  }

  // ==========================================
  // NEW: Delete Advance Payment Handler
  // ==========================================
  const handleDeleteAdvancePayment = async (paymentId: string) => {
    if (!confirm("Delete this payment record? / यह भुगतान रिकॉर्ड हटाएं?")) return
    
    setDeletingPaymentId(paymentId)
    try {
      const res = await fetch(`/api/advance-payments?id=${paymentId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        await fetchEvent()  // Refresh to get updated total
        toast({ title: "Payment Deleted", description: "Advance payment removed" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setDeletingPaymentId(null)
    }
  }

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

  // ← NEW: Calculate advance payment totals for display
  const advancePayments = event.advancePayments || []
  const advanceTotal = event.advancePayment || 0
  const remainingAmount = Math.max(0, (event.totalAmount || 0) - advanceTotal)
  // ← NEW: Check if fully paid (all installments cover the total)
  const isFullyPaid = advanceTotal >= (event.totalAmount || 0) && (event.totalAmount || 0) > 0

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
              {/* ← NEW: Show "Fully Paid" badge if all installments cover total */}
              {isFullyPaid && (
                <Badge variant="success" className="font-semibold">Fully Paid ✓</Badge>
              )}
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
            <h1 className="text-xl font-bold" style={{ margin: "10px 16px" }}>{event.organizerName}</h1>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0 text-xs text-black" style={{ margin: "2px 16px" }}>
            <span>📅 {formatDate(event.functionDate)}</span>
            <span>🍰 {event.functionTime}</span>
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
                  <label className="label mb-1.5 block">Per Plate Price / प्रति प्लेट मूल्य (₹)</label>
                  <Input type="number" value={editFormData.perPlatePrice} onChange={e => setEditFormData(prev => ({ ...prev, perPlatePrice: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Notes / नोट्स</label>
                  <textarea className="input min-h-[80px] resize-none w-full" value={editFormData.notes} onChange={e => setEditFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Any special instructions" />
                </div>
                {/* ← CHANGED: Show total, advance, and remaining in edit mode */}
                {/* Total updates live as guest count / per plate price change */}
                {/* Advance comes from installments (read-only here) */}
                {/* Remaining = new total - advance (updates live!) */}
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-lg text-primary flex items-center"><IndianRupee className="w-4 h-4" />{editTotalAmount.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{editFormData.guestCount || 0} guests × ₹{editFormData.perPlatePrice || 0}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Advance Paid (from installments)</span>
                    <span className="font-semibold text-green-700 flex items-center"><IndianRupee className="w-4 h-4" />{(event?.advancePayment || 0).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Managed in Advance Payments section →</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remaining / बाकी</span>
                    <span className={`font-semibold text-lg flex items-center ${editRemainingAmount <= 0 ? "text-green-600" : "text-amber-600"}`}>
                      <IndianRupee className="w-4 h-4" />
                      {editRemainingAmount <= 0 ? "0 (Fully Paid ✓)" : editRemainingAmount.toLocaleString()}
                    </span>
                  </div>
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

            {/* ===================== PAYMENT SUMMARY (non-edit mode) ===================== */}
            {!isEditing && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-medium mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Payment Summary / भुगतान</h3>
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
                    <span className="text-muted-foreground">Total Advance Paid</span>
                    <span className="font-medium text-green-600 flex items-center">
                      <IndianRupee className="w-3 h-3" />{advanceTotal.toLocaleString()}
                      {/* ← NEW: Show installment count */}
                      {advancePayments.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({advancePayments.length} installment{advancePayments.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-medium">Remaining</span>
                    <span className={`font-semibold flex items-center ${isFullyPaid ? "text-green-600" : "text-amber-600"}`}>
                      <IndianRupee className="w-3 h-3" />
                      {isFullyPaid ? "0 (Fully Paid ✓)" : remainingAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ===================== RIGHT COLUMN ===================== */}
          <div className="space-y-6">
            {/* Menu Items Card */}
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

            {/* ============================================ */}
            {/* NEW: Advance Payments (Installments) Card    */}
            {/* ============================================ */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-green-600" />
                  Advance Payments / अग्रिम भुगतान
                </h2>
                {/* Toggle add form button */}
                {!isEditing && (
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setShowAddPayment(!showAddPayment)
                      // Set default date to today
                      if (!newPaymentDate) {
                        setNewPaymentDate(new Date().toISOString().split("T")[0])
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Payment
                  </Button>
                )}
              </div>

              {/* ← NEW: Add Payment Form (collapsible) */}
              {showAddPayment && !isEditing && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4 space-y-3">
                  <p className="text-sm font-medium text-green-800">New Installment / नई किस्त</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label mb-1 block text-xs">Amount (₹) *</label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={newPaymentAmount}
                        onChange={e => setNewPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Date / तारीख *</label>
                      <Input
                        type="date"
                        value={newPaymentDate}
                        onChange={e => setNewPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Notes (optional)</label>
                    <Input
                      placeholder="e.g., Cash payment, UPI, Cheque #..."
                      value={newPaymentNotes}
                      onChange={e => setNewPaymentNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleAddAdvancePayment} 
                      loading={addingPayment}
                      disabled={!newPaymentAmount || !newPaymentDate}
                    >
                      <Save className="w-4 h-4 mr-1" />Save Payment
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => { setShowAddPayment(false); setNewPaymentAmount(""); setNewPaymentNotes("") }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* ← NEW: Installments List */}
              {advancePayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No advance payments recorded yet / कोई अग्रिम भुगतान दर्ज नहीं
                </p>
              ) : (
                <div className="space-y-2">
                  {advancePayments.map((payment, index) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Installment number */}
                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-green-700 flex items-center">
                            <IndianRupee className="w-3 h-3" />
                            {payment.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(payment.paidDate)}
                            {/* Show notes if any */}
                            {payment.notes && (
                              <span className="ml-1 text-muted-foreground">• {payment.notes}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Delete button for each installment */}
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteAdvancePayment(payment.id)}
                          loading={deletingPaymentId === payment.id}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* ← NEW: Total row at bottom */}
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total Advance ({advancePayments.length} installment{advancePayments.length !== 1 ? "s" : ""})
                    </span>
                    <span className="font-bold text-green-700 flex items-center text-lg">
                      <IndianRupee className="w-4 h-4" />
                      {advanceTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* ← NEW: Remaining indicator */}
                  {!isFullyPaid && (event.totalAmount || 0) > 0 && (
                    <div className="flex justify-between items-center p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <span className="text-amber-700">Remaining / शेष</span>
                      <span className="font-semibold text-amber-700 flex items-center">
                        <IndianRupee className="w-3 h-3" />
                        {remainingAmount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* ← NEW: Fully paid indicator */}
                  {isFullyPaid && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-center text-sm font-medium text-green-700">
                      ✓ Fully Paid / पूर्ण भुगतान हो गया
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ===================== PRINT ONLY - Menu Items ===================== */}
        <div className="hidden print:block" style={{ marginTop: "3px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, marginLeft:"20px", marginBottom: "2px", borderBottom: "1px solid #d1d5db", paddingBottom: "1px" }}>
            Menu Items 
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gridAutoFlow: "column",
            gridTemplateRows: `repeat(${Math.ceil((event.eventItems?.length || 0) / 4)}, auto)`,
            gap: "0px",
            border: "1px solid #e5e7eb",
            borderRadius: "3px",
            overflow: "hidden",
            margin: "0 16px"
          }}>
            {event.eventItems?.map(ei => (
              <div
                key={ei.id}
                style={{
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                  fontSize: "13px",
                  lineHeight: "1.15",
                  padding: "1px 4px",
                  borderRight: "1px solid #e5e7eb",
                  borderBottom: "1px solid #f3f4f6",
                  fontWeight: "bold",
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
            <h2 style={{ fontSize: "14px", fontWeight: 700, marginLeft:"20px", marginBottom: "2px", borderBottom: "1px solid #d1d5db", paddingBottom: "1px" }}>
              Ingredients 
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridAutoFlow: "column",
              gridTemplateRows: `repeat(${Math.ceil(groupedIngredients.flatMap(g => g.ingredients).length / 4)}, auto)`,
              gap: "2px 0px",
              border: "1px solid black",
              borderRadius: "4px",
              overflow: "hidden",
              margin: "0 16px"
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
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ing.name}
                    </span>
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, color: "#1f2937" }}>
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