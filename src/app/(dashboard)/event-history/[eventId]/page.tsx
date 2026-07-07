"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Calendar, Clock, Users, Phone, MapPin, Home, ChefHat,
  FileDown, Printer, Trash2, Package, IndianRupee, CreditCard,
  Copy, Edit, Save, X, Plus, Banknote, UtensilsCrossed
} from "lucide-react"
import {
  Button, Input, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Dialog, DialogContent,
  DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui"
import { Card, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event, AdvancePayment } from "@/types"
import { formatDate } from "@/lib/utils"

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
  ingredients: { id: string; name: string; unit: string; quantity: number }[]
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function EventHistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  // ----- Core State -----
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // ----- Edit Mode State -----
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editFormData, setEditFormData] = useState({
    organizerName: "",
    phoneNumbers: [""],
    location: "",
    homeAddress: "",
    functionDate: "",
    functionTime: "",
    notes: ""
  })

  // Per-meal editing: keyed by "mealLabel::date"
  // e.g. { "breakfast::2026-03-20": { mealType: "breakfast", date: "2026-03-20", guests: "100", perPlate: "500" } }
  const [editMealData, setEditMealData] = useState<
    Record<string, { mealType: string; date: string; guests: string; perPlate: string }>
  >({})

  // ----- Copy Dialog State -----
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyFormData, setCopyFormData] = useState({
    organizerName: "",
    phoneNumber: "",
    homeAddress: "",
    location: ""
  })

  // CHANGED: Per-meal selection for enhanced copy
  interface CopyMealSelection {
    originalLabel: string
    originalDate: string | null
    selected: boolean
    newMealType: string
    newDate: string
    newGuests: string
    newPerPlate: string
    itemCount: number
  }
  const [copyMeals, setCopyMeals] = useState<CopyMealSelection[]>([])

  // ----- Advance Payment State -----
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [newPaymentAmount, setNewPaymentAmount] = useState("")
  const [newPaymentDate, setNewPaymentDate] = useState("")
  const [newPaymentNotes, setNewPaymentNotes] = useState("")
  const [addingPayment, setAddingPayment] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)

  // =============================================
  // DATA FETCHING
  // =============================================

  useEffect(() => {
    fetchEvent()
  }, [params.eventId])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}?t=${Date.now()}`)
      const data = await res.json()
      if (data.success) setEvent(data.data)
    } catch {
      toast({ title: "Error", description: "Failed to load event", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // =============================================
  // COMPUTED / DERIVED DATA
  // =============================================

  // Group eventItems by mealLabel + mealDate
  const mealGroups = useMemo((): MealGroup[] => {
    if (!event?.eventItems) return []
    const groups: Record<string, MealGroup> = {}

    event.eventItems.forEach((ei: any) => {
      const label = ei.mealLabel || "default"
      const dateStr = ei.mealDate ? String(ei.mealDate).split("T")[0] : ""
      const key = `${label}::${dateStr}`

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          date: ei.mealDate ? String(ei.mealDate) : null,
          guests: ei.mealGuests ?? null,
          perPlate: ei.mealPerPlate ?? null,
          items: []
        }
      }
      groups[key].items.push({
        id: ei.id,
        itemId: ei.itemId,
        name: ei.item?.name || "Unknown"
      })
    })

    return Object.values(groups)
  }, [event])

  // Total from meal groups (guests × perPlate for each meal)
  const calculatedTotal = useMemo(() => {
    return mealGroups.reduce((sum, g) => sum + ((g.guests || 0) * (g.perPlate || 0)), 0)
  }, [mealGroups])

  // Edit mode total — calculated from editMealData
  const editTotalAmount = useMemo(() => {
    return Object.values(editMealData).reduce((sum, m) => {
      return sum + ((parseInt(m.guests) || 0) * (parseFloat(m.perPlate) || 0))
    }, 0)
  }, [editMealData])

  // Group ingredients by category (only those with quantity > 0)
  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event?.eventIngredients) return []
    const groups: Record<string, GroupedIngredient> = {}

    event.eventIngredients.forEach((ei: any) => {
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

    // Sort ingredients within each category, then sort categories
    Object.values(groups).forEach(g =>
      g.ingredients.sort((a, b) => a.name.localeCompare(b.name))
    )
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [event?.eventIngredients])

  const totalIngredients = groupedIngredients.reduce((sum, g) => sum + g.ingredients.length, 0)

  // ----- Payment Calculations -----
  const advancePayments = event?.advancePayments || []
  const advanceTotal = event?.advancePayment || 0
  const displayTotal = calculatedTotal || event?.totalAmount || 0
  const remainingAmount = Math.max(0, displayTotal - advanceTotal)
  const isFullyPaid = advanceTotal >= displayTotal && displayTotal > 0

  const editRemainingAmount = useMemo(() => {
    return Math.max(0, editTotalAmount - (event?.advancePayment || 0))
  }, [editTotalAmount, event?.advancePayment])

  // =============================================
  // EDIT HANDLERS
  // =============================================

  const startEditing = () => {
    if (!event) return

    // Populate phone numbers
    const phones = event.phoneNumber
      ? event.phoneNumber.split(",").map((p: string) => p.trim())
      : [""]

    setEditFormData({
      organizerName: event.organizerName || "",
      phoneNumbers: phones.length > 0 ? phones : [""],
      location: event.location || "",
      homeAddress: event.homeAddress || "",
      functionDate: "",
      functionTime: "",
      notes: event.notes || ""
    })

    // Populate per-meal edit data from current mealGroups
    const mealData: Record<string, { mealType: string; date: string; guests: string; perPlate: string }> = {}
    mealGroups.forEach(g => {
      mealData[g.key] = {
        mealType: g.label === "default" ? event.functionTime : g.label,
        date: g.date ? new Date(g.date).toISOString().split('T')[0] : "",
        guests: String(g.guests || ""),
        perPlate: String(g.perPlate || "")
      }
    })
    setEditMealData(mealData)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  // Phone number helpers
  const addPhoneNumber = () => {
    if (editFormData.phoneNumbers.length < 4) {
      setEditFormData(prev => ({
        ...prev,
        phoneNumbers: [...prev.phoneNumbers, ""]
      }))
    }
  }

  const removePhoneNumber = (idx: number) => {
    if (editFormData.phoneNumbers.length > 1) {
      setEditFormData(prev => ({
        ...prev,
        phoneNumbers: prev.phoneNumbers.filter((_: any, i: number) => i !== idx)
      }))
    }
  }

  const updatePhoneNumber = (idx: number, val: string) => {
    setEditFormData(prev => {
      const p = [...prev.phoneNumbers]
      p[idx] = val
      return { ...prev, phoneNumbers: p }
    })
  }

  // Meal edit helper
  const updateMealEdit = (key: string, field: 'mealType' | 'date' | 'guests' | 'perPlate', value: string) => {
    setEditMealData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  // Save all changes
  const saveChanges = async () => {
    if (!event) return

    const validPhoneNumbers = editFormData.phoneNumbers.filter((p: string) => p.trim())
    if (!editFormData.organizerName || validPhoneNumbers.length === 0) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      // Build updateMealLabels from editMealData
      const updateMealLabels = mealGroups.map(g => ({
        mealLabel: g.label === "default" ? null : g.label,
        mealDate: g.date,
        newMealLabel: editMealData[g.key]?.mealType || g.label,
        newMealDate: editMealData[g.key]?.date || g.date,
        mealGuests: parseInt(editMealData[g.key]?.guests) || 0,
        mealPerPlate: parseFloat(editMealData[g.key]?.perPlate) || 0
      }))

      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerName: editFormData.organizerName,
          phoneNumber: validPhoneNumbers.join(", "),
          location: editFormData.location,
          homeAddress: editFormData.homeAddress,
          notes: editFormData.notes,
          updateMealLabels
        })
      })

      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        setIsEditing(false)
        toast({ title: "Success", description: "Event updated!" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // =============================================
  // ADVANCE PAYMENT HANDLERS
  // =============================================

  const handleAddAdvancePayment = async () => {
    if (!event) return
    const amount = parseFloat(newPaymentAmount)
    if (!amount || amount <= 0 || !newPaymentDate) {
      toast({ title: "Error", description: "Enter valid amount and date", variant: "destructive" })
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
      if ((await res.json()).success) {
        await fetchEvent()
        setNewPaymentAmount("")
        setNewPaymentDate("")
        setNewPaymentNotes("")
        setShowAddPayment(false)
        toast({ title: "Payment Added", description: `₹${amount.toLocaleString()}` })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingPayment(false)
    }
  }

  const handleDeleteAdvancePayment = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return
    setDeletingPaymentId(paymentId)
    try {
      const res = await fetch(`/api/advance-payments?id=${paymentId}`, { method: "DELETE" })
      if ((await res.json()).success) {
        await fetchEvent()
        toast({ title: "Payment Deleted" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setDeletingPaymentId(null)
    }
  }

  // =============================================
  // STATUS & DELETE HANDLERS
  // =============================================

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
      if ((await res.json()).success) {
        await fetchEvent()
        toast({ title: "Success", description: `Status: ${newStatus}` })
      }
    } catch {
      toast({ title: "Error", description: "Failed", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const deleteEvent = async () => {
    if (!confirm("Delete this event?")) return
    try {
      const res = await fetch(`/api/events/${params.eventId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted" })
        router.push("/event-history")
      }
    } catch {}
  }

  // =============================================
  // COPY EVENT HANDLERS
  // =============================================

  const openCopyDialog = () => {
    if (!event) return
    setCopyFormData({
      organizerName: "",
      phoneNumber: "",
      homeAddress: event.homeAddress || "",
      location: event.location || ""
    })

    // CHANGED: Build meal selections from current mealGroups
    const meals: CopyMealSelection[] = mealGroups.map(g => ({
      originalLabel: g.label,
      originalDate: g.date ? String(g.date).split("T")[0] : null,
      selected: true,
      newMealType: g.label === "default" ? event.functionTime : g.label,
      newDate: g.date ? new Date(g.date).toISOString().split("T")[0] : "",
      newGuests: String(g.guests || ""),
      newPerPlate: String(g.perPlate || ""),
      itemCount: g.items.length
    }))
    setCopyMeals(meals)
    setCopyDialogOpen(true)
  }
  

  const handleCopyEvent = async () => {
    if (!event || !copyFormData.organizerName || !copyFormData.phoneNumber) {
      toast({ title: "Error", description: "Fill organizer name and phone", variant: "destructive" })
      return
    }
 
    // CHANGED: Validate selected meals
    const selected = copyMeals.filter(m => m.selected)
    if (selected.length === 0) {
      toast({ title: "Error", description: "Select at least one meal to copy", variant: "destructive" })
      return
    }
    for (let i = 0; i < selected.length; i++) {
      if (!selected[i].newDate || !selected[i].newMealType) {
        toast({ title: "Error", description: `Meal "${selected[i].newMealType || i + 1}": Fill date and type`, variant: "destructive" })
        return
      }
    }
 
    setCopying(true)
    try {
      const res = await fetch("/api/events/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEventId: event.id,
          organizerName: copyFormData.organizerName,
          phoneNumber: copyFormData.phoneNumber,
          homeAddress: copyFormData.homeAddress || null,
          location: copyFormData.location,
          // CHANGED: Send selectedMeals array
          selectedMeals: selected.map(m => ({
            originalLabel: m.originalLabel,
            originalDate: m.originalDate,
            newMealType: m.newMealType,
            newDate: m.newDate,
            newGuests: m.newGuests,
            newPerPlate: m.newPerPlate
          }))
        })
      })
      const data = await res.json()
      if (data.success) {
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

  // =============================================
  // CSV EXPORT
  // =============================================

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
  }

  // =============================================
  // LOADING / ERROR STATES
  // =============================================

  if (loading) return <Loading text="Loading event..." />
  if (!event) {
    return (
      <div className="empty-state">
        <p>Event not found</p>
        <Button onClick={() => router.push("/event-history")} className="mt-4">Back</Button>
      </div>
    )
  }

  const statusColors: Record<string, any> = {
    active: "success",
    completed: "primary",
    cancelled: "destructive"
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <>
      

      <div className="max-w-5xl mx-auto print:max-w-none print:m-0 print:p-[6px] animate-in">

        {/* ========== SCREEN ONLY: Top Navigation ========== */}
        <div className="no-print">
          <Button variant="ghost" onClick={() => router.push("/event-history")} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to History
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            {/* Left: Badges */}
            <div className="flex items-center gap-3">
              <Badge variant="primary" className="font-mono">{event.eventId}</Badge>
              <Badge variant={statusColors[event.status] || "warning"}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </Badge>
              {isFullyPaid && (
                <Badge variant="success" className="font-semibold">Fully Paid ✓</Badge>
              )}
            </div>

            {/* Right: Action Buttons */}
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
                  <Button variant="outline" onClick={startEditing}>
                    <Edit className="w-4 h-4 mr-2" />Edit
                  </Button>
                  <Button variant="outline" onClick={openCopyDialog}>
                    <Copy className="w-4 h-4 mr-2" />Copy
                  </Button>
                  <Button variant="outline" onClick={exportCSV}>
                    <FileDown className="w-4 h-4 mr-2" />CSV
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />Print
                  </Button>
                  <Button variant="destructive" onClick={deleteEvent}>
                    <Trash2 className="w-4 h-4 mr-2" />Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={saveChanges} loading={saving}>
                    <Save className="w-4 h-4 mr-2" />Save
                  </Button>
                  <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                    <X className="w-4 h-4 mr-2" />Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========== PRINT ONLY: Header ========== */}
        <div className="hidden print:block print:mb-0.5 print:pb-0.5 border-b-2 border-black" style={{ lineHeight: 1.2 }}>
          <h1 className="text-xl font-bold" style={{ margin: "10px 16px" }}>
            {event.organizerName}
          </h1>
          <div className="flex flex-wrap gap-x-2 gap-y-0 text-xs text-black" style={{ margin: "2px 16px" }}>
            {/* <span>📅 {formatDate(event.functionDate)}</span> */}
            <span>🍰 {event.functionTime}</span>
            {/* <span>👥 {event.guestCount} Guests</span> */}
            <span>📍 {event.location}</span>
            {event.homeAddress && <span>🏠 {event.homeAddress}</span>}
            <span>📞 {event.phoneNumber}</span>
          </div>
        </div>

        {/* ========== SCREEN: Organizer Name / Edit ========== */}
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

        {/* ========== SCREEN: Two Column Layout ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">

          {/* ---------- LEFT COLUMN: Event Details ---------- */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Event Details / इवेंट विवरण</h2>

            {isEditing ? (
              <div className="space-y-4">

                {/* Phone Numbers */}
                <div>
                  <label className="label mb-1.5 block flex items-center gap-2">
                    <Phone className="w-4 h-4" />Phone Numbers * (Max 4)
                  </label>
                  <div className="space-y-2">
                    {editFormData.phoneNumbers.map((phone: string, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          type="tel"
                          placeholder={`Phone ${idx + 1}`}
                          value={phone}
                          onChange={e => updatePhoneNumber(idx, e.target.value)}
                          className="flex-1"
                        />
                        {editFormData.phoneNumbers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePhoneNumber(idx)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {editFormData.phoneNumbers.length < 4 && (
                      <Button type="button" variant="outline" size="sm" onClick={addPhoneNumber} className="w-full">
                        <Plus className="w-4 h-4 mr-1" />Add Number
                      </Button>
                    )}
                  </div>
                </div>

               {/* Venue Location */}
                <div>
                  <label className="label mb-1.5 block flex items-center gap-2">
                    <MapPin className="w-4 h-4" />Venue Location / कार्यक्रम स्थल
                  </label>
                  <Input
                    value={editFormData.location}
                    onChange={e => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>

                {/* CHANGED: Home Address */}
                <div>
                  <label className="label mb-1.5 block flex items-center gap-2">
                    <Home className="w-4 h-4" />Home Address / घर का पता
                  </label>
                  <Input
                    value={editFormData.homeAddress}
                    onChange={e => setEditFormData(prev => ({ ...prev, homeAddress: e.target.value }))}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="label mb-1.5 block">Notes</label>
                  <textarea
                    className="input min-h-[80px] resize-none w-full"
                    value={editFormData.notes}
                    onChange={e => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                {/* ---- Per-Meal Editing ---- */}
                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" />
                    Meal Details / भोजन विवरण
                  </h3>
                  <div className="space-y-3">
                    {mealGroups.map(g => (
                      <div key={g.key} className="p-3 border rounded-lg space-y-2">
                        {/* Row 1: Meal Type + Date */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label mb-1 block text-xs">Meal Type</label>
                            <Select
                              value={editMealData[g.key]?.mealType || ""}
                              onValueChange={v => updateMealEdit(g.key, 'mealType', v)}
                            >
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {MEAL_TYPES.map(m => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="label mb-1 block text-xs">Date / तारीख</label>
                            <Input
                              type="date"
                              value={editMealData[g.key]?.date || ""}
                              onChange={e => updateMealEdit(g.key, 'date', e.target.value)}
                            />
                          </div>
                        </div>
                        {/* Row 2: Guests + Per Plate */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label mb-1 block text-xs">Guests / मेहमान</label>
                            <Input
                              type="number"
                              value={editMealData[g.key]?.guests || ""}
                              onChange={e => updateMealEdit(g.key, 'guests', e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block text-xs">Per Plate (₹)</label>
                            <Input
                              type="number"
                              value={editMealData[g.key]?.perPlate || ""}
                              onChange={e => updateMealEdit(g.key, 'perPlate', e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        {/* Subtotal */}
                        <p className="text-xs text-muted-foreground text-right">
                          = ₹{((parseInt(editMealData[g.key]?.guests) || 0) * (parseFloat(editMealData[g.key]?.perPlate) || 0)).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---- Edit Mode Totals ---- */}
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-lg text-primary flex items-center">
                      <IndianRupee className="w-4 h-4" />{editTotalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Advance Paid</span>
                    <span className="font-semibold text-green-700 flex items-center">
                      <IndianRupee className="w-4 h-4" />{(event?.advancePayment || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <span className={`font-semibold text-lg flex items-center ${editRemainingAmount <= 0 ? "text-green-600" : "text-amber-600"}`}>
                      <IndianRupee className="w-4 h-4" />
                      {editRemainingAmount <= 0 ? "0 (Fully Paid ✓)" : editRemainingAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ---- View Mode ---- */
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{event.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Venue Location / कार्यक्रम स्थल</p>
                    <p className="font-medium">{event.location}</p>
                  </div>
                </div>
                {/* CHANGED: Home Address display */}
                {event.homeAddress && (
                  <div className="flex items-start gap-3">
                    <Home className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Home Address / घर का पता</p>
                      <p className="font-medium">{event.homeAddress}</p>
                    </div>
                  </div>
                )}
                {event.menuCreationDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Menu Creation Date</p>
                      <p className="font-medium">{formatDate(event.menuCreationDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- Payment Summary (View Mode Only) ---- */}
            {!isEditing && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />Payment Summary / भुगतान
                </h3>
                <div className="space-y-2">
                  {/* Per-meal breakdown */}
                  {mealGroups.map(g => (
                    <div key={g.key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {g.label === "default" ? event.functionTime : g.label}
                        {g.date ? ` (${formatDate(g.date)})` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {g.guests || 0} × ₹{(g.perPlate || 0).toLocaleString()} = ₹{((g.guests || 0) * (g.perPlate || 0)).toLocaleString()}
                      </span>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium flex items-center">
                      <IndianRupee className="w-3 h-3" />{displayTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* Advance Paid */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Advance Paid</span>
                    <span className="font-medium text-green-600 flex items-center">
                      <IndianRupee className="w-3 h-3" />{advanceTotal.toLocaleString()}
                      {advancePayments.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">({advancePayments.length})</span>
                      )}
                    </span>
                  </div>

                  {/* Remaining */}
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

          {/* ---------- RIGHT COLUMN ---------- */}
          <div className="space-y-6">

            {/* ---- Menu Items (grouped by meal label) ---- */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Menu Items / मेन्यू आइटम</h2>
              {mealGroups.map((group, idx) => (
                <div key={group.key} className={idx > 0 ? "mb-4 pt-3 border-t" : "mb-4"}>
                  {/* Meal header */}
                  <div className="flex items-center gap-2 mb-2">
                    <UtensilsCrossed className={`w-4 h-4 ${idx === 0 ? "text-primary" : "text-secondary"}`} />
                    <span className="text-sm font-semibold capitalize">
                      {group.label === "default" ? event.functionTime : group.label}
                    </span>
                    {group.date && (
                      <span className="text-xs text-muted-foreground">({formatDate(group.date)})</span>
                    )}
                    {group.guests != null && (
                      <Badge variant="secondary" className="text-xs">{group.guests} guests</Badge>
                    )}
                  </div>
                  {/* Items grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(item => (
                      <div key={item.id} className="ingredient-card">
                        <ChefHat className={`w-4 h-4 ${idx === 0 ? "text-primary" : "text-secondary"} shrink-0`} />
                        <span className="font-medium truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>

            {/* ---- Advance Payments ---- */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-green-600" />Advance Payments
                </h2>
                {!isEditing && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowAddPayment(!showAddPayment)
                      if (!newPaymentDate) setNewPaymentDate(new Date().toISOString().split("T")[0])
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />Add
                  </Button>
                )}
              </div>

              {/* Add Payment Form */}
              {showAddPayment && !isEditing && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label mb-1 block text-xs">Amount (₹) *</label>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={newPaymentAmount}
                        onChange={e => setNewPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Date *</label>
                      <Input
                        type="date"
                        value={newPaymentDate}
                        onChange={e => setNewPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Notes</label>
                    <Input
                      placeholder="Cash, UPI..."
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
                      <Save className="w-4 h-4 mr-1" />Save
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

              {/* Payment List */}
              {advancePayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No advance payments yet</p>
              ) : (
                <div className="space-y-2">
                  {advancePayments.map((payment: any, idx: number) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-green-700 flex items-center">
                            <IndianRupee className="w-3 h-3" />{payment.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDate(payment.paidDate)}
                            {payment.notes && ` • ${payment.notes}`}
                          </p>
                        </div>
                      </div>
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteAdvancePayment(payment.id)}
                          loading={deletingPaymentId === payment.id}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Payment Total */}
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total ({advancePayments.length})
                    </span>
                    <span className="font-bold text-green-700 flex items-center text-lg">
                      <IndianRupee className="w-4 h-4" />{advanceTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* Remaining / Fully Paid indicators */}
                  {!isFullyPaid && displayTotal > 0 && (
                    <div className="flex justify-between items-center p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <span className="text-amber-700">Remaining</span>
                      <span className="font-semibold text-amber-700 flex items-center">
                        <IndianRupee className="w-3 h-3" />{remainingAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {isFullyPaid && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-center text-sm font-medium text-green-700">
                      ✓ Fully Paid
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ========== PRINT ONLY: Menu Items per Meal ========== */}
        <div className="hidden print:block" style={{ marginTop: "3px" }}>
          {mealGroups.map((group, idx) => (
            <div key={group.key} style={{ marginTop: idx > 0 ? "6px" : "0" }}>
              <h2 style={{
                fontSize: "14px", fontWeight: 700, marginLeft: "2px", marginBottom: "2px",
                borderBottom: "1px solid #d1d5db", paddingBottom: "1px", textTransform: "capitalize"
              }}>
                {group.label === "default" ? event.functionTime : group.label}
                {group.date ? ` (${formatDate(group.date)})` : ""}
                {group.guests ? ` — ${group.guests} guests` : ""}
              </h2>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridAutoFlow: "column",
                gridTemplateRows: `repeat(${Math.ceil(group.items.length / 4)}, auto)`,
                gap: "0px", border: "1px solid #e5e7eb", borderRadius: "3px",
                overflow: "hidden", margin: "0 16px"
              }}>
                {group.items.map(item => (
                  <div key={item.id} style={{
                    breakInside: "avoid", pageBreakInside: "avoid",
                    fontSize: "13px", lineHeight: "1.15", padding: "1px 4px",
                    borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #f3f4f6", fontWeight: "bold"
                  }}>
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ========== SCREEN: Ingredients List ========== */}
        {groupedIngredients.length > 0 && (
          <Card className="mt-6 print:hidden">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-secondary" />
              <h2 className="text-lg font-semibold">Ingredients / सामग्री</h2>
              <Badge variant="success">{totalIngredients}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {groupedIngredients.flatMap(g =>
                g.ingredients.map(ing => (
                  <div key={ing.id} className="ingredient-card">
                    <span className="font-medium truncate mr-1">{ing.name}</span>
                    <span className="text-primary font-semibold whitespace-nowrap">
                      {ing.quantity} {ing.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* ========== PRINT ONLY: Ingredients ========== */}
        {groupedIngredients.length > 0 && (
          <div className="hidden print:block" style={{ marginTop: "3px" }}>
            <h2 style={{
              fontSize: "14px", fontWeight: 700, marginLeft: "20px", marginBottom: "2px",
              borderBottom: "1px solid #d1d5db", paddingBottom: "1px"
            }}>
              Ingredients
            </h2>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridAutoFlow: "column",
              gridTemplateRows: `repeat(${Math.ceil(groupedIngredients.flatMap(g => g.ingredients).length / 4)}, auto)`,
              gap: "2px 0px", border: "1px solid black", borderRadius: "4px",
              overflow: "hidden", margin: "0 16px"
            }}>
              {groupedIngredients.flatMap(g =>
                g.ingredients.map(ing => (
                  <div key={ing.id} style={{
                    breakInside: "avoid", pageBreakInside: "avoid",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: "12px", padding: "1px 4px",
                    borderRight: "1px solid black", borderBottom: "1px solid black",
                    gap: "2px", minWidth: 0
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ing.name}
                    </span>
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {ing.quantity} {ing.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========== SCREEN: Notes ========== */}
        {!isEditing && event.notes && (
          <Card className="mt-6 print:hidden">
            <h2 className="text-lg font-semibold mb-2">Notes</h2>
            <p className="text-muted-foreground">{event.notes}</p>
          </Card>
        )}

        {/* ========== PRINT ONLY: Notes ========== */}
        {event.notes && (
          <div className="hidden print:block" style={{ marginTop: "2px", fontSize: "10px" }}>
            <span className="font-semibold">Notes:</span> {event.notes}
          </div>
        )}

        {/* ========== Copy Event Dialog ========== */}
         <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>
                <Copy className="w-5 h-5 inline mr-2" />Copy Event
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
 
              {/* Section A: New Event Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">New Event Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Organizer Name *"
                    value={copyFormData.organizerName}
                    onChange={e => setCopyFormData(prev => ({ ...prev, organizerName: e.target.value }))}
                  />
                  <Input
                    label="Phone *"
                    type="tel"
                    value={copyFormData.phoneNumber}
                    onChange={e => setCopyFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Home Address / घर का पता"
                    value={copyFormData.homeAddress}
                    onChange={e => setCopyFormData(prev => ({ ...prev, homeAddress: e.target.value }))}
                  />
                  <Input
                    label="Venue Location / कार्यक्रम स्थल"
                    value={copyFormData.location}
                    onChange={e => setCopyFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
              </div>
 
              {/* Section B: Select Meals to Copy */}
              <div className="space-y-3 pt-3 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  Select Meals to Copy ({copyMeals.filter(m => m.selected).length}/{copyMeals.length})
                </h3>
 
                {copyMeals.map((meal, idx) => (
                  <div
                    key={idx}
                    className={`p-3 border rounded-lg space-y-2 transition-colors ${
                      meal.selected ? "bg-primary/5 border-primary/30" : "opacity-50 bg-muted/30"
                    }`}
                  >
                    {/* Meal checkbox + info */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={meal.selected}
                        onChange={e => {
                          setCopyMeals(prev => prev.map((m, i) =>
                            i === idx ? { ...m, selected: e.target.checked } : m
                          ))
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-medium capitalize">{meal.originalLabel === "default" ? event.functionTime : meal.originalLabel}</span>
                        {meal.originalDate && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Source: {formatDate(meal.originalDate)})
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                          — {meal.itemCount} items
                        </span>
                      </div>
                    </div>
 
                    {/* Editable fields (only when selected) */}
                    {meal.selected && (
                      <div className="grid grid-cols-4 gap-2 ml-7">
                        <div>
                          <label className="label mb-1 block text-xs">Copy as</label>
                          <Select
                            value={meal.newMealType}
                            onValueChange={v => {
                              setCopyMeals(prev => prev.map((m, i) =>
                                i === idx ? { ...m, newMealType: v } : m
                              ))
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MEAL_TYPES.map(mt => (
                                <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="label mb-1 block text-xs">Date *</label>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={meal.newDate}
                            onChange={e => {
                              setCopyMeals(prev => prev.map((m, i) =>
                                i === idx ? { ...m, newDate: e.target.value } : m
                              ))
                            }}
                          />
                        </div>
                        <div>
                          <label className="label mb-1 block text-xs">Guests</label>
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            placeholder="0"
                            value={meal.newGuests}
                            onChange={e => {
                              setCopyMeals(prev => prev.map((m, i) =>
                                i === idx ? { ...m, newGuests: e.target.value } : m
                              ))
                            }}
                          />
                        </div>
                        <div>
                          <label className="label mb-1 block text-xs">Per Plate ₹</label>
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            placeholder="0"
                            value={meal.newPerPlate}
                            onChange={e => {
                              setCopyMeals(prev => prev.map((m, i) =>
                                i === idx ? { ...m, newPerPlate: e.target.value } : m
                              ))
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
 
              {/* Info note about shared ingredients */}
              {copyMeals.some(m => !m.selected) && copyMeals.some(m => m.selected) && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <p className="font-medium">⚠️ Partial copy</p>
                  <p>Ingredients shared with unselected meals will be marked for review on the Event Menu page.</p>
                </div>
              )}
            </div>
 
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCopyEvent}
                loading={copying}
                disabled={copyMeals.filter(m => m.selected).length === 0}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy {copyMeals.filter(m => m.selected).length} meal(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}