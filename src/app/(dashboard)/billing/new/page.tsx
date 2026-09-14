"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  IndianRupee, Calendar, User, Percent, Receipt, Banknote, ArrowLeft
} from "lucide-react"
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading, Badge } from "@/components/shared"
import { CustomerEventCard, BillItemsTable, BillSummaryCard, type BillLineItem } from "@/components/billing"
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/apiClient"
import { formatDate } from "@/lib/utils"

// =============================================
// BILL COMPOSER
// =============================================
// CHANGED: this is the old billing page's "Create Bill" tab, moved to its own route so
// it can be opened WITH the events already chosen: /billing/new?events=id1,id2 from the
// history page's selection bar, or ?bill=<id> to edit an existing bill.
//
// It is a route rather than a dialog on the history page because the form is
// substantial — items table, discount, SGST/CGST, client GST number, notes, live
// summary — and it was already correct. Only its entry point changed. The phone search
// stays for the one case history cannot cover: billing something with no event behind it.

interface AdvancePaymentDetail {
  id: string
  amount: number
  paidDate: string
  notes?: string | null
}

interface MealGroupForBill {
  label: string
  date: string | null
  guests: number
  perPlate: number
}

interface EventForBill {
  id: string
  eventId: string
  organizerName: string
  phoneNumber: string
  functionDate: string
  functionTime: string
  guestCount: number
  perPlatePrice: number
  totalAmount: number
  advancePayment: number
  status: string
  catererCost?: number
  clientCost?: number
  advancePayments?: AdvancePaymentDetail[]
  mealGroups?: MealGroupForBill[]
  billedAs?: { billId: string; billNumber: string } | null
}

// useSearchParams must sit inside a Suspense boundary or the production build fails
// prerendering this route ("useSearchParams() should be wrapped in a suspense boundary").
export default function NewBillPage() {
  return (
    <Suspense fallback={<Loading text="Loading..." />}>
      <BillComposer />
    </Suspense>
  )
}

function BillComposer() {
  const searchParams = useSearchParams()
  const presetEventIds = searchParams.get("events")
  const editBillId = searchParams.get("bill")
  const { toast } = useToast()

  // Owner-only, like every other billing surface.
  useEffect(() => {
    let cancelled = false
    fetch("/api/user/organization")
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.success && d.data.role !== "owner") window.location.replace("/dashboard")
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const [customerName, setCustomerName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [address, setAddress] = useState("")
  const [clientGstNo, setClientGstNo] = useState("")
  const [items, setItems] = useState<BillLineItem[]>([{ description: "", quantity: 1, rate: 0, amount: 0 }])
  const [discountType, setDiscountType] = useState<string>("")
  const [discountValue, setDiscountValue] = useState("")
  const [sgst, setSgst] = useState("0")
  const [cgst, setCgst] = useState("0")
  const [notes, setNotes] = useState("")
  const [creating, setCreating] = useState(false)
  const [customerEvents, setCustomerEvents] = useState<EventForBill[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [prefilled, setPrefilled] = useState(false)

  // Turn one event into bill rows — one row per MEAL, because each meal has its own
  // guest count and per-plate price and the client needs to see them separately.
  const rowsForEvent = (event: EventForBill): BillLineItem[] => {
    const meals = event.mealGroups || []
    if (meals.length === 0) {
      return [{
        description: `${event.functionTime} - ${formatDate(event.functionDate)} (${event.guestCount} guests)`,
        quantity: event.guestCount,
        rate: event.perPlatePrice,
        amount: event.totalAmount,
        eventId: event.id
      }]
    }
    return meals.map(meal => ({
      description: `${meal.label} - ${meal.date ? formatDate(meal.date) : formatDate(event.functionDate)} (${meal.guests} guests)`,
      quantity: meal.guests,
      rate: meal.perPlate,
      amount: meal.guests * meal.perPlate,
      eventId: event.id
    }))
  }

  // ---- Arriving from the history page with events already selected ----
  useEffect(() => {
    if (!presetEventIds || prefilled || editBillId) return
    let cancelled = false
    setLoadingEvents(true)
    fetch(`/api/bills/events-by-phone?ids=${presetEventIds}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.success) return
        const events: EventForBill[] = d.data
        if (events.length === 0) return
        setCustomerEvents(events)
        setPhoneNumber(events[0].phoneNumber || "")
        setCustomerName(events[0].organizerName || "")
        setSelectedEventIds(events.map(e => e.id))
        setItems(events.flatMap(rowsForEvent))
        setPrefilled(true)
      })
      .catch(() => toast({ title: "Error", description: "Could not load the selected events", variant: "destructive" }))
      .finally(() => { if (!cancelled) setLoadingEvents(false) })
    return () => { cancelled = true }
  }, [presetEventIds, prefilled, editBillId])

  // ---- Editing an existing bill ----
  useEffect(() => {
    if (!editBillId) return
    let cancelled = false
    fetch(`/api/bills/${editBillId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.success) return
        const bill = d.data
        setCustomerName(bill.customerName)
        setPhoneNumber(bill.phoneNumber)
        setAddress(bill.address || "")
        setClientGstNo(bill.clientGstNo || "")
        setItems(bill.items.map((i: any) => ({
          id: i.id, description: i.description, quantity: i.quantity,
          rate: i.rate, amount: i.amount, eventId: i.eventId
        })))
        setDiscountType(bill.discountType || "")
        setDiscountValue(bill.discountValue?.toString() || "")
        setSgst(bill.sgst?.toString() || "0")
        setCgst(bill.cgst?.toString() || "0")
        setNotes(bill.notes || "")
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [editBillId])

  // ---- Standalone phone search (a bill with no event behind it) ----
  const searchEventsByPhone = async () => {
    if (!phoneNumber || phoneNumber.length < 10) return
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/bills/events-by-phone?phoneNumber=${phoneNumber}`)
      const data = await res.json()
      if (data.success) setCustomerEvents(data.data)
    } catch { /* the panel simply stays empty */ }
    finally { setLoadingEvents(false) }
  }

  useEffect(() => {
    if (presetEventIds || editBillId) return
    if (phoneNumber.length >= 10) {
      const timer = setTimeout(searchEventsByPhone, 500)
      return () => clearTimeout(timer)
    }
    setCustomerEvents([])
    setSelectedEventIds([])
  }, [phoneNumber, presetEventIds, editBillId])

  // CHANGED: subtotal / discount / tax / total used to be computed here, a fourth copy of
  // the arithmetic that also lives in the two bill API routes. BillSummaryCard calls the
  // shared billTotals() instead, so the number the operator approves and the number the
  // server stores cannot drift apart.

  const totalAdvanceForSelected = useMemo(
    () => customerEvents.filter(e => selectedEventIds.includes(e.id)).reduce((sum, e) => sum + (e.advancePayment || 0), 0),
    [customerEvents, selectedEventIds]
  )

  const selectedEventsAdvanceDetails = useMemo(
    () => customerEvents
      .filter(e => selectedEventIds.includes(e.id) && (e.advancePayments?.length || 0) > 0)
      .map(e => ({
        eventId: e.eventId, functionDate: e.functionDate, functionTime: e.functionTime,
        advancePayment: e.advancePayment, advancePayments: e.advancePayments || []
      })),
    [customerEvents, selectedEventIds]
  )

  // Events on this bill that already have one — the soft block on double-billing.
  // Warned, not prevented: reissuing a corrected invoice is a real thing a caterer does.
  const alreadyBilled = useMemo(
    () => customerEvents.filter(e => selectedEventIds.includes(e.id) && e.billedAs && e.billedAs.billId !== editBillId),
    [customerEvents, selectedEventIds, editBillId]
  )

  const addItem = () => setItems([...items, { description: "", quantity: 1, rate: 0, amount: 0 }])
  const updateItem = (index: number, field: keyof BillLineItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === "quantity" || field === "rate") newItems[index].amount = newItems[index].quantity * newItems[index].rate
    setItems(newItems)
  }
  const removeItem = (index: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)) }

  const addEventToBill = (event: EventForBill) => {
    setItems([...items.filter(i => i.description), ...rowsForEvent(event)])
    if (!customerName) setCustomerName(event.organizerName)
    setSelectedEventIds(prev => prev.includes(event.id) ? prev : [...prev, event.id])
  }

  const save = async () => {
    if (!customerName || !phoneNumber) {
      toast({ title: "Error", description: "Customer name and phone required", variant: "destructive" }); return
    }
    const validItems = items.filter(i => i.description && i.rate > 0)
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" }); return
    }
    setCreating(true)
    const payload = {
      customerName, phoneNumber, address, clientGstNo, items: validItems,
      discountType: discountType && discountType !== "none" ? discountType : null,
      discountValue: parseFloat(discountValue) || 0,
      sgst: parseFloat(sgst) || 0, cgst: parseFloat(cgst) || 0, notes
    }
    try {
      if (editBillId) {
        await api.put(`/api/bills/${editBillId}`, { ...payload, updateItems: true })
        toast({ title: "Success", description: "Bill updated" })
      } else {
        const created = await api.post<{ billNumber: string }>("/api/bills", payload)
        toast({ title: "Success", description: `Bill ${created.billNumber} created!` })
      }
      window.location.href = "/billing"
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => window.location.href = "/billing"}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2">
            <Receipt className="w-8 h-8 text-primary" />
            {editBillId ? "Edit Bill" : "New Bill / नया बिल"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {presetEventIds ? "Events selected from Event History" : "Create an invoice"}
          </p>
        </div>
      </div>

      {alreadyBilled.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-800">
            <p className="font-semibold">⚠️ Already billed</p>
            <p className="mt-1">
              {alreadyBilled.map(e => `${formatDate(e.functionDate)} → ${e.billedAs!.billNumber}`).join(", ")}
            </p>
            <p className="mt-1 text-xs">
              Creating another bill is allowed — a reissued invoice is a normal correction — but check
              you are not invoicing the same function twice.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Customer Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Customer Name / ग्राहक का नाम *" placeholder="Enter customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <Input label="Phone Number / फोन नंबर *" placeholder="Enter phone number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                <Input label="Address / पता" placeholder="Enter address" value={address} onChange={e => setAddress(e.target.value)} />
                <Input label="Client GST No." placeholder="N/A" value={clientGstNo} onChange={e => setClientGstNo(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <BillItemsTable
            items={items}
            onChange={updateItem}
            onAdd={addItem}
            onRemove={removeItem}
          />

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5" />Discount & Tax</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="label mb-1.5 block">Discount Type</label><Select value={discountType} onValueChange={setDiscountType}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed Amount (₹)</SelectItem></SelectContent></Select></div>
                <Input label="Discount Value" type="number" placeholder="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={!discountType || discountType === "none"} />
                <Input label="SGST (%)" type="number" placeholder="0" value={sgst} onChange={e => setSgst(e.target.value)} />
                <Input label="CGST (%)" type="number" placeholder="0" value={cgst} onChange={e => setCgst(e.target.value)} />
              </div>
              <div className="mt-4"><Input label="Notes / टिप्पणी" placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {phoneNumber.length >= 10 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4" />Events for {phoneNumber}<Badge variant="secondary">{customerEvents.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {loadingEvents ? <Loading className="min-h-[100px]" /> : customerEvents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No events found</p> : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {customerEvents.map(event => (
                      <CustomerEventCard
                        key={event.id}
                        event={event as any}
                        selected={selectedEventIds.includes(event.id)}
                        onSelect={() => addEventToBill(event)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedEventsAdvanceDetails.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" />Advance Payments / अग्रिम भुगतान</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedEventsAdvanceDetails.map(ed => (
                    <div key={ed.eventId} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{ed.functionTime} — {formatDate(ed.functionDate)}</p>
                      {ed.advancePayments.map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-[10px]">{idx + 1}</span>
                            <span className="font-semibold text-green-700">₹{p.amount.toLocaleString("en-IN")}</span>
                            <span className="text-muted-foreground">{formatDate(p.paidDate)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-medium pt-1 border-t"><span>Subtotal</span><span className="text-green-700">₹{ed.advancePayment.toLocaleString("en-IN")}</span></div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t-2 border-green-200"><span className="text-sm font-semibold">Total Advance</span><span className="text-lg font-bold text-green-700 flex items-center"><IndianRupee className="w-4 h-4" />{totalAdvanceForSelected.toLocaleString("en-IN")}</span></div>
                </div>
              </CardContent>
            </Card>
          )}

          <BillSummaryCard
            items={items}
            discountType={discountType}
            discountValue={discountValue}
            sgst={sgst}
            cgst={cgst}
            advancePaid={totalAdvanceForSelected}
            isEditing={!!editBillId}
            saving={creating}
            onSave={save}
            onCancel={() => { window.location.href = "/billing" }}
          />
        </div>
      </div>
    </div>
  )
}
