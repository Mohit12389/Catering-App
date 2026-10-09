"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"  // CHANGED: back buttons are real links
import {
  ArrowLeft, Calendar, Phone, MapPin, Home,  // CHANGED: ChefHat moved into MealItemsGrid
  Trash2, Package, IndianRupee, CreditCard,
  Copy, Edit, Save, X, Plus, UtensilsCrossed, Receipt, ArrowUpDown  // CHANGED: + ArrowUpDown (Arrange)
} from "lucide-react"
import {
  Button, Input, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui"
import { Card, Loading, Badge, useCurrentUser } from "@/components/shared" // CHANGED: + useCurrentUser
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/apiClient" // CHANGED: normalises fetch + error handling
import { formatDate, errorMessage } from "@/lib/utils"
import { MEAL_TYPES } from "@/lib/meals"  // CHANGED: was a local duplicate of this list
import { groupIntoMeals, groupIngredientsByCategory, compareByPositionThenCategory } from "@/lib/mealGroups"  // CHANGED: shared event projections; menu items in arranged order
import { useConfirm } from "@/components/shared"
import { CopyEventDialog, AdvancePaymentsCard, MealItemsGrid, type CopyMealSelection } from "@/components/events" // CHANGED: extracted dialog + card; + MealItemsGrid (drag & drop order)
import { DownloadDropdown } from "@/components/shared"
// CHANGED: the stage badge is derived here, never read from Event.status
import { eventStage, paymentStatusOf, STAGE_SHORT, STAGE_VARIANTS } from "@/lib/paymentStatus"
import type { EventDetail } from "@/types" // CHANGED: typed event

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
  notes: string | null  // CHANGED: per-meal note
  items: { id: string; itemId: string; name: string; position: number | null; categorySortOrder: number; categoryName: string }[]  // CHANGED: + position
}

interface GroupedIngredient {
  categoryId: string
  categoryName: string
  sortOrder: number
  ingredients: { id: string; name: string; unit: string; quantity: number; notes: string | null }[]  // CHANGED: + notes (printed)
}

// =============================================
// MAIN COMPONENT
// =============================================

// CHANGED: last loaded copy of each event, for this browser tab only (cleared on a full
// reload). Keyed by viewer + event, so a different account signing in on the same tab
// never sees another user's cached copy. Only used to paint instantly while the fresh
// copy loads — every visit still fetches.
const eventCache = new Map<string, EventDetail>()

export default function EventHistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  // ----- Core State -----
  // CHANGED: start from the copy loaded earlier in this tab (if any), so going back to an
  // event shows it at once; fetchEvent below still refreshes it in the background.
  const currentUser = useCurrentUser()
  const cacheKey = `${currentUser.id}:${params.eventId}`
  const [event, setEvent] = useState<EventDetail | null>(() => eventCache.get(cacheKey) ?? null) // CHANGED: typed (was any); + cached start
  const [loading, setLoading] = useState(() => !eventCache.has(cacheKey)) // CHANGED: no spinner when a cached copy is shown
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
  // CHANGED: + notes (per-meal note)
  const [editMealData, setEditMealData] = useState<
    Record<string, { mealType: string; date: string; guests: string; perPlate: string; notes: string }>
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

  // CHANGED: CopyMealSelection moved to components/events with the dialog that uses it.
  const [copyMeals, setCopyMeals] = useState<CopyMealSelection[]>([])

  // ----- Advance Payment State -----
  const [addingPayment, setAddingPayment] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  // CHANGED: Print mode - 'full' includes ingredients, 'menuOnly' excludes them
  const [printMode, setPrintMode] = useState<"full" | "menuOnly">("full")

  // CHANGED: drag & drop menu order — which meal (by meal key) is being arranged, one at a time
  const [arrangingMealKey, setArrangingMealKey] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  // CHANGED: role comes from the layout (useCurrentUser) instead of a /api/user/organization
  // fetch — one less round trip, and staff no longer briefly see payment info while it loads.
  const userRole = currentUser.role || "owner"

  // =============================================
  // DATA FETCHING
  // =============================================

  useEffect(() => {
    fetchEvent()
    // CHANGED: load only when the event id changes. Listing fetchEvent (recreated every
    // render) would refetch on every render and hammer the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.eventId])

  // CHANGED: Reset print mode after printing
  useEffect(() => {
    const handleAfterPrint = () => setPrintMode("full")
    window.addEventListener("afterprint", handleAfterPrint)
    return () => window.removeEventListener("afterprint", handleAfterPrint)
  }, [])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}?t=${Date.now()}`) // still always fresh; the cache only covers the wait
      const data = await res.json()
      if (data.success) {
        setEvent(data.data)
        eventCache.set(cacheKey, data.data) // CHANGED: remember for the next visit in this tab
      }
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
  // CHANGED: shared groupIntoMeals — the composite-key grouping was an inline copy
  const mealGroups = useMemo((): MealGroup[] => groupIntoMeals(
    event?.eventItems,
    (ei) => ({
      id: ei.id,
      itemId: ei.itemId,
      name: ei.item?.name || "Unknown",
      position: ei.position ?? null,  // CHANGED: drag & drop order
      categorySortOrder: ei.item?.category?.sortOrder || 0,
      categoryName: ei.item?.category?.name || ""
    }),
    { sortItems: compareByPositionThenCategory }  // CHANGED: arranged order first (was category rank, then name)
  ), [event])

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
  // CHANGED: shared groupIngredientsByCategory (was an inline copy)
  const groupedIngredients = useMemo((): GroupedIngredient[] => groupIngredientsByCategory(
    event?.eventIngredients,
    (ei) => ({
      id: ei.ingredient?.category?.id || "uncategorized",
      name: ei.ingredient?.category?.name || "Other",
      sortOrder: ei.ingredient?.category?.sortOrder || 0
    }),
    (ei) => ({
      id: ei.id,
      name: ei.ingredient?.name || "Unknown",
      unit: ei.ingredient?.unit || "",
      quantity: ei.quantity,
      notes: ei.notes || null  // CHANGED: packing notes, printed next to the name like Word/Excel
    }),
    {
      include: (ei) => ei.quantity > 0,
      sortIngredients: (a, b) => a.name.localeCompare(b.name),
      tieBreakByName: true
    }
  ), [event?.eventIngredients])

  const totalIngredients = groupedIngredients.reduce((sum, g) => sum + g.ingredients.length, 0)

  // ----- Payment Calculations -----
  const advancePayments = event?.advancePayments || []
  const advanceTotal = event?.advancePayment || 0
  // CHANGED: once the event is on a bill, that bill decides what is owed — discount and
  // tax included. Until then it is the quote (recalculated live while editing meals).
  const billing = event?.billedAs // CHANGED: typed via EventDetail (was an `as any` cast)
  // What the meals add up to right now — the quote, which moves with the guest count.
  const quotedTotal = calculatedTotal || event?.totalAmount || 0
  // What is actually owed. The bill wins once one exists: it is where the number stopped
  // moving and where any discount was applied.
  const displayTotal = billing?.amount ?? quotedTotal
  const remainingAmount = Math.max(0, displayTotal - advanceTotal)
  const isFullyPaid = advanceTotal >= displayTotal && displayTotal > 0

  // CHANGED: Upcoming / Done / Completed / Cancelled, computed from the last sub-event
  // date, whether a bill points at this event, and what has been paid. Completed needs
  // all three — the event has happened, an invoice exists, and it is settled.
  const stage = eventStage({
    storedStatus: event?.status,
    lastMealDate: event?.lastMealDate ?? event?.functionDate, // CHANGED: - as any
    isBilled: !!billing,
    paymentStatus: paymentStatusOf(advanceTotal, displayTotal)
  })

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
    const mealData: Record<string, { mealType: string; date: string; guests: string; perPlate: string; notes: string }> = {}
    mealGroups.forEach(g => {
      mealData[g.key] = {
        mealType: g.label === "default" ? event.functionTime : g.label,
        date: g.date ? new Date(g.date).toISOString().split('T')[0] : "",
        guests: String(g.guests || ""),
        perPlate: String(g.perPlate || ""),
        notes: g.notes || ""  // CHANGED: per-meal note
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
        phoneNumbers: prev.phoneNumbers.filter((_: string, i: number) => i !== idx) // CHANGED: any -> string
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
  const updateMealEdit = (key: string, field: 'mealType' | 'date' | 'guests' | 'perPlate' | 'notes', value: string) => {
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
        mealPerPlate: parseFloat(editMealData[g.key]?.perPlate) || 0,
        mealNotes: editMealData[g.key]?.notes ?? ""  // CHANGED: per-meal note ("" clears it)
      }))

      await api.put(`/api/events/${params.eventId}`, {
          organizerName: editFormData.organizerName,
          phoneNumber: validPhoneNumbers.join(", "),
          location: editFormData.location,
          homeAddress: editFormData.homeAddress,
          notes: editFormData.notes,
          updateMealLabels
        })
      await fetchEvent()
      setIsEditing(false)
      toast({ title: "Success", description: "Event updated!" })

    } catch (error) {
      toast({ title: "Error", description: errorMessage(error), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // =============================================
  // ADVANCE PAYMENT HANDLERS
  // =============================================

  // CHANGED: takes the form values as arguments and reports whether it saved, because
  // the add-payment form now lives inside AdvancePaymentsCard and clears itself.
  const handleAddAdvancePayment = async (
    amountInput: string, paidDate: string, notes: string
  ): Promise<boolean> => {
    if (!event) return false
    const amount = parseFloat(amountInput)
    if (!amount || amount <= 0 || !paidDate) {
      toast({ title: "Error", description: "Enter valid amount and date", variant: "destructive" })
      return false
    }

    setAddingPayment(true)
    try {
      await api.post("/api/advance-payments", {
        eventId: event.id,
        amount,
        paidDate,
        notes: notes.trim() || null
      })
      await fetchEvent()
      toast({ title: "Payment Added", description: `₹${amount.toLocaleString("en-IN")}` })
      return true
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error), variant: "destructive" })
      return false
    } finally {
      setAddingPayment(false)
    }
  }

  // CHANGED: save one meal's arranged menu order. Updates the page in place from the
  // saved order instead of reloading the whole event (one request, not two).
  const handleSaveItemOrder = async (orderedIds: string[]) => {
    setSavingOrder(true)
    try {
      await api.put(`/api/events/${params.eventId}/item-order`, { eventItemIds: orderedIds })
      const pos = new Map(orderedIds.map((id, i) => [id, i + 1]))
      setEvent((prev) => {
        const next = prev && { // CHANGED: typed (was any)
          ...prev,
          eventItems: prev.eventItems.map((ei) => pos.has(ei.id) ? { ...ei, position: pos.get(ei.id) ?? null } : ei)
        }
        if (next) eventCache.set(cacheKey, next) // CHANGED: keep the cached copy in the saved order
        return next
      })
      setArrangingMealKey(null)
      toast({ title: "Order saved / क्रम सेव हुआ" })
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error), variant: "destructive" })
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDeleteAdvancePayment = async (paymentId: string) => {
    const ok = await confirm({
      title: "Delete this payment?",
      description: "This advance payment record will be permanently removed. This cannot be undone."
    })
    if (!ok) return
    setDeletingPaymentId(paymentId)
    try {
      await api.del(`/api/advance-payments?id=${paymentId}`)
      await fetchEvent()
      toast({ title: "Payment Deleted" })
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error), variant: "destructive" })
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
      await api.put(`/api/events/${params.eventId}`, { status: newStatus })
      await fetchEvent()
      toast({ title: "Success", description: `Status: ${newStatus}` })
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error) || "Failed", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const deleteEvent = async () => {
    const ok = await confirm({
      title: "Delete this event?",
      description: "All menu items, ingredients, and payments will be permanently removed. This cannot be undone."
    })
    if (!ok) return
    try {
      // CHANGED: was `if (res.ok)` with `catch {}` — a refused delete said nothing at
      // all, and the operator was left looking at an event they thought was gone.
      await api.del(`/api/events/${params.eventId}`)
      toast({ title: "Deleted" })
      router.push("/event-history")
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error) || "Failed to delete", variant: "destructive" })
    }
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
      newNotes: g.notes || "",  // CHANGED: per-meal note, editable in the copy dialog
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
      const copied = await api.post<{ id: string }>("/api/events/copy", {
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
            newPerPlate: m.newPerPlate,
            newNotes: m.newNotes  // CHANGED: per-meal note
          }))
        })
      setCopyDialogOpen(false)
      router.push(`/event-menu/${copied.id}`)

    } catch (error) {
      toast({ title: "Error", description: errorMessage(error), variant: "destructive" })
    } finally {
      setCopying(false)
    }
  }

  // CHANGED: removed unused exportCSV (no button called it)

  // =============================================
  // LOADING / ERROR STATES
  // =============================================

  if (loading) return <Loading text="Loading event..." />
  if (!event) {
    return (
      <div className="empty-state">
        <p>Event not found</p>
        <Button asChild className="mt-4"><Link href="/event-history">Back</Link></Button>  {/* CHANGED: real link */}
      </div>
    )
  }


  // =============================================
  // RENDER
  // =============================================

  return (
    <>
      

      <div className="max-w-5xl mx-auto print:max-w-none print:m-0 print:p-[6px] animate-in">

        {/* ========== SCREEN ONLY: Top Navigation ========== */}
        <div className="no-print">
          {/* CHANGED: real link so it can open in a new tab */}
          <Button asChild variant="ghost" className="mb-6">
            <Link href="/event-history"><ArrowLeft className="w-4 h-4 mr-2" />Back to History</Link>
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            {/* Left: Badges */}
            <div className="flex items-center gap-3">
              <Badge variant="primary" className="font-mono"></Badge>
              {/* CHANGED: derived stage replaces the manually-set status badge. Billed is
                  a separate badge, not a stage — an invoiced event still has to say
                  whether the function has happened. */}
              <Badge variant={STAGE_VARIANTS[stage]}>{STAGE_SHORT[stage]}</Badge>
              {userRole !== "staff" && (
                billing ? (
                  <Badge variant="primary" className="font-mono text-xs">
                    Billed 
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Billed</Badge>
                )
              )}
              {isFullyPaid && (
                <Badge variant="success" className="font-semibold">Fully Paid ✓</Badge>
              )}
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* CHANGED: only Active and Cancelled remain. "Completed" used to be set by
                  hand here and went stale the moment anyone forgot — it is now derived
                  (happened + billed + paid) and shown in the badge on the left. Cancelling
                  is the one call a human genuinely makes about an event's lifecycle. */}
              <Select value={event.status === "cancelled" ? "cancelled" : "active"} onValueChange={updateStatus} disabled={updating || isEditing}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* CHANGED: bill this event straight from the page the operator is on. */}
              {userRole !== "staff" && !isEditing && (
                // CHANGED: real link (full page load, as before) so it can open in a new tab
                <Button asChild variant="outline">
                  <a href={`/billing/new?events=${event.id}`}>
                    <Receipt className="w-4 h-4 mr-2" />
                    {billing ? "Bill Again" : "Create Bill"}
                  </a>
                </Button>
              )}

              {!isEditing ? (
                <>
                  <Button variant="outline" onClick={startEditing}>
                    <Edit className="w-4 h-4 mr-2" />Edit
                  </Button>
                  <Button variant="outline" onClick={openCopyDialog}>
                    <Copy className="w-4 h-4 mr-2" />Copy
                  </Button>
                  <DownloadDropdown options={[
     {
       label: "Print (PDF)",
       icon: "print",
       onClick: () => { setPrintMode("full"); setTimeout(() => window.print(), 100) }
     },
     {
       label: "Print Menu (PDF)",
       icon: "print",
       onClick: () => { setPrintMode("menuOnly"); setTimeout(() => window.print(), 100) }
     },
     {
       label: "Word (.docx)",
       icon: "word",
       onClick: () => window.open(`/api/export/event-docx?eventId=${event.id}&mode=full`)
     },
     {
       label: "Word Menu (.docx)",
       icon: "word",
       onClick: () => window.open(`/api/export/event-docx?eventId=${event.id}&mode=menuOnly`)
     },
     {
       label: "Excel (.xlsx)",
       icon: "excel",
       onClick: () => window.open(`/api/export/event-xlsx?eventId=${event.id}&mode=full`)
     },
     {
       label: "Excel Menu (.xlsx)",
       icon: "excel",
       onClick: () => window.open(`/api/export/event-xlsx?eventId=${event.id}&mode=menuOnly`)
     }
   ]} />
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
            <span>📍 Venue: {event.location}</span>
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
                        {/* CHANGED: Row 3: per-meal note */}
                        <div>
                          <label className="label mb-1 block text-xs">Meal Note / भोजन नोट</label>
                          <Input
                            value={editMealData[g.key]?.notes || ""}
                            onChange={e => updateMealEdit(g.key, 'notes', e.target.value)}
                            placeholder="e.g. serve at 8pm"
                          />
                        </div>
                        {/* Subtotal */}
                        <p className="text-xs text-muted-foreground text-right">
                          = ₹{((parseInt(editMealData[g.key]?.guests) || 0) * (parseFloat(editMealData[g.key]?.perPlate) || 0)).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---- Edit Mode Totals ---- */}
                {userRole !== "staff" && (<>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-lg text-primary flex items-center">
                      <IndianRupee className="w-4 h-4" />{editTotalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Advance Paid</span>
                    <span className="font-semibold text-green-700 flex items-center">
                      <IndianRupee className="w-4 h-4" />{(event?.advancePayment || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <span className={`font-semibold text-lg flex items-center ${editRemainingAmount <= 0 ? "text-green-600" : "text-amber-600"}`}>
                      <IndianRupee className="w-4 h-4" />
                      {editRemainingAmount <= 0 ? "0 (Fully Paid ✓)" : editRemainingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                </>)}
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
            {!isEditing && userRole !== "staff" && (
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
                        {g.guests || 0} × ₹{(g.perPlate || 0).toLocaleString("en-IN")} = ₹{((g.guests || 0) * (g.perPlate || 0)).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}

                  {/* CHANGED: when the event is on a bill, show how the menu quote became
                      the billed figure. Without this the page simply displayed a smaller
                      number than the meals add up to, and nothing on screen explained it —
                      the per-meal rows above would not reconcile with the total below. */}
                  {billing ? (
                    <>
                      <div className="flex justify-between pt-2 border-t text-sm">
                        <span className="text-muted-foreground">Quoted on bill</span>
                        <span className="flex items-center text-muted-foreground">
                          <IndianRupee className="w-3 h-3" />{billing.itemsTotal.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* The menu can be edited after a bill is raised. Say so rather than
                          letting the meal rows above quietly disagree with this figure. */}
                      {Math.round(quotedTotal) !== billing.itemsTotal && (
                        <p className="text-xs text-amber-600">
                          The menu now totals ₹{Math.round(quotedTotal).toLocaleString("en-IN")} —
                          it changed after {billing.billNumber} was raised. Edit the bill to bring them back in line.
                        </p>
                      )}

                      {billing.discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Discount / छूट ({billing.billNumber})</span>
                          <span className="flex items-center">
                            −<IndianRupee className="w-3 h-3" />{billing.discountAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}

                      {billing.taxAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">SGST + CGST</span>
                          <span className="flex items-center text-muted-foreground">
                            +<IndianRupee className="w-3 h-3" />{billing.taxAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-medium">Billed Amount / बिल राशि</span>
                        <span className="font-semibold flex items-center">
                          <IndianRupee className="w-3 h-3" />{displayTotal.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium flex items-center">
                        <IndianRupee className="w-3 h-3" />{displayTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Advance Paid */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Advance Paid</span>
                    <span className="font-medium text-green-600 flex items-center">
                      <IndianRupee className="w-3 h-3" />{advanceTotal.toLocaleString("en-IN")}
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
                      {isFullyPaid ? "0 (Fully Paid ✓)" : remainingAmount.toLocaleString("en-IN")}
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
                    {/* CHANGED: per-meal note */}
                    {group.notes && <span className="text-xs text-amber-700">· {group.notes}</span>}
                    {/* CHANGED: Arrange button — one meal at a time, hidden while editing the event */}
                    {!isEditing && arrangingMealKey !== group.key && group.items.length > 1 && (
                      <Button
                        variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs"
                        disabled={arrangingMealKey !== null}
                        onClick={() => setArrangingMealKey(group.key)}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 mr-1" />Arrange / क्रम बदलें
                      </Button>
                    )}
                  </div>
                  {/* Items grid — CHANGED: 4 columns, top-to-bottom like print, drag & drop when arranging */}
                  <MealItemsGrid
                    items={group.items}
                    iconClassName={idx === 0 ? "text-primary" : "text-secondary"}
                    arranging={arrangingMealKey === group.key && !isEditing}
                    saving={savingOrder}
                    onSave={handleSaveItemOrder}
                    onCancel={() => setArrangingMealKey(null)}
                  />
                </div>
              ))}
            </Card>

            {userRole !== "staff" && (
              <AdvancePaymentsCard
                payments={advancePayments}
                total={advanceTotal}
                remaining={remainingAmount}
                isFullyPaid={isFullyPaid}
                eventTotal={displayTotal}
                isEditing={isEditing}
                onAdd={handleAddAdvancePayment}
                adding={addingPayment}
                onDelete={handleDeleteAdvancePayment}
                deletingPaymentId={deletingPaymentId}
              />
            )}
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
                {/* CHANGED: per-meal note on the heading line — amber like ingredient notes,
                    not bold, and not capitalized by the heading's textTransform */}
                {group.notes && (
                  <span style={{ fontSize: "12px", fontWeight: 400, color: "#b45309", textTransform: "none" }}>
                    {"  · Note: "}{group.notes}
                  </span>
                )}
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
        {groupedIngredients.length > 0 && printMode !== "menuOnly" &&(
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
                    {/* CHANGED: + the ingredient's packing note in amber (it goes to the vendor).
                        The name now wraps instead of being cut off with "…", so a note always fits. */}
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {ing.name}
                      {ing.notes && (
                        <span style={{ color: "#b45309", fontSize: "10px" }}> ({ing.notes})</span>
                      )}
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

        {/* CHANGED: Footer note for menu-only print */}
        {printMode === "menuOnly" && (
          <div className="hidden print:block" style={{
            marginTop: "10px",
            padding: "6px 16px",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "13px",
            borderTop: "2px solid black"
          }}>
            * Price will increase as the number of guests increases / मेहमानों की संख्या बढ़ने पर कीमत बढ़ेगी
          </div>
        )}

        <CopyEventDialog
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
          formData={copyFormData}
          onFormDataChange={setCopyFormData}
          meals={copyMeals}
          onMealsChange={setCopyMeals}
          defaultMealLabel={event.functionTime}
          onCopy={handleCopyEvent}
          copying={copying}
        />
      </div>
    </>
  )
}