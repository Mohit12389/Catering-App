"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  History, Calendar, Users, MapPin, Home, ArrowRight,
  Search, UtensilsCrossed, Phone, FileDown, IndianRupee, Receipt, X
} from "lucide-react"
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from "@/components/ui"
import { Card, Loading, EmptyState, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { formatDate, cn } from "@/lib/utils"
import { compareMeals } from "@/lib/meals"  // CHANGED: shared meal ordering
// CHANGED: stage and payment state are DERIVED here, never read from a stored column.
import {
  eventStage, paymentStatusOf, balanceOf, isActiveStage,
  STAGE_SHORT, STAGE_VARIANTS, PAYMENT_SHORT, PAYMENT_VARIANTS
} from "@/lib/paymentStatus"

export default function EventHistoryPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Date range for print filter
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Fetch user role to hide advance column for staff
  const [userRole, setUserRole] = useState<string>("owner")
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/user/organization")
        const data = await res.json()
        if (data.success) setUserRole(data.data.role || "owner")
      } catch {}
    }
    fetchRole()
  }, [])

  const { data: events = [], isLoading } = useSWRFetch<any[]>('/api/events')

  // CHANGED: events selected for a bill. One bill belongs to ONE customer, so the
  // selection is locked to a single phone number — see selectionPhone below.
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // CHANGED: the checkboxes are hidden until "Create Bill" is pressed. Billing is an
  // occasional act; reading this table is the daily one, and a permanent checkbox column
  // charged every visit for something wanted on a few of them.
  const [selecting, setSelecting] = useState(false)

  // CHANGED: stage and payment status are computed from money, dates and whether a bill
  // exists. Nothing here reads Event.status except to honour "cancelled", which is the
  // one state a human decides. This replaces the old manually-toggled Completed status,
  // which drifted the moment someone forgot to set it.
  const decorated = useMemo(() => events.map(event => {
    // receivable is what the event actually owes: its share of the bill once one exists
    // (so a discount applied on the bill lands here), the quote until then.
    const receivable = event.receivable ?? event.totalAmount
    const paymentStatus = paymentStatusOf(event.advancePayment || 0, receivable)
    return {
      ...event,
      receivable,
      paymentStatus,
      stage: eventStage({
        storedStatus: event.status,
        // lastMealDate is the LAST sub-event date; functionDate (the earliest) is only
        // a fallback for an event whose meals carry no dates.
        lastMealDate: event.lastMealDate ?? event.functionDate,
        isBilled: !!event.billedAs,
        paymentStatus
      })
    }
  }), [events])

  // Filter events by search, status, and date range
  const filteredEvents = useMemo(() => {
    return decorated.filter(event => {
      // Search filter
      const matchesSearch = 
        event.organizerName.toLowerCase().includes(search.toLowerCase()) ||
        event.eventId.toLowerCase().includes(search.toLowerCase()) ||
        event.location.toLowerCase().includes(search.toLowerCase()) ||
        event.phoneNumber?.toLowerCase().includes(search.toLowerCase())

      // CHANGED: filters on the DERIVED stage, not the stored status column.
      // "active" groups Upcoming and Done — everything still on the operator's plate,
      // whether the function is next week or happened last month and is unsettled. He
      // scans for those together, so making him pick between two filters was wrong.
      const matchesStatus =
        statusFilter === "all" ? true :
        statusFilter === "active" ? isActiveStage(event.stage) :
        statusFilter === "unbilled" ? (!event.billedAs && event.stage !== "cancelled") :
        event.stage === statusFilter

      // Date range filter
      let matchesDate = true
      if (startDate) {
        matchesDate = matchesDate && new Date(event.functionDate) >= new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        matchesDate = matchesDate && new Date(event.functionDate) <= end
      }

      return matchesSearch && matchesStatus && matchesDate
    }).sort((a, b) => new Date(a.functionDate).getTime() - new Date(b.functionDate).getTime())
  }, [decorated, search, statusFilter, startDate, endDate])

  // CHANGED: billing selection. The first ticked row fixes the customer; every row on a
  // different phone number is then disabled. A bill covering two customers is never
  // right, so this is blocked outright rather than warned about.
  const selectionPhone = useMemo(() => {
    if (selectedIds.length === 0) return null
    return decorated.find(e => e.id === selectedIds[0])?.phoneNumber ?? null
  }, [selectedIds, decorated])

  const selectedEvents = useMemo(
    () => decorated.filter(e => selectedIds.includes(e.id)),
    [decorated, selectedIds]
  )
  const selectedTotal = selectedEvents.reduce((sum, e) => sum + (e.totalAmount || 0), 0)

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const exitSelecting = () => {
    setSelecting(false)
    setSelectedIds([])
  }

  const createBillForSelection = () => {
    // The composer is a route, not a dialog: it is the same bill form the billing page
    // has always used (items, discount, GST, notes, live summary), reached with the
    // events already chosen instead of by typing a phone number.
    window.location.href = `/billing/new?events=${selectedIds.join(",")}`
  }

  // Print handler
  const handleExportCSV = async () => {
    // CHANGED: Fetch role fresh to ensure correct columns
    let role = userRole
    try {
      const res = await fetch("/api/user/organization")
      const data = await res.json()
      if (data.success) role = data.data.role || "owner"
    } catch {}

    // CHANGED: Stage and Payment are the derived values, matching the table exactly.
    // Payment moved behind the staff check with the money columns — it is a statement
    // about the owner's takings, and staff are not sent the amounts it is computed from.
    let csv = "Event Date,Organizer,Event ID,Phone,Home Address,Venue Location,Meals,Items,Menu Created,Stage"
    if (role !== "staff") csv += ",Billed,Bill No,Payment,Amount Due,Advance,Remaining"
    csv += "\n"

    filteredEvents.forEach(event => {
      const mealLabels = event.mealLabels || []
      const mealsStr = mealLabels.length > 0
        ? mealLabels.map((m: any) => `${m.label}(${m.guests || 0}g)`).join(" | ")
        : `${event.guestCount} guests`
      const totalItems = event.eventItems?.length || 0
      const remaining = balanceOf(event.advancePayment || 0, event.receivable)

      csv += `"${formatDate(event.functionDate)}","${event.organizerName}","${event.eventId}","${event.phoneNumber}","${event.homeAddress || ""}","${event.location}","${mealsStr}",${totalItems},"${event.menuCreationDate ? formatDate(event.menuCreationDate) : "-"}","${STAGE_SHORT[event.stage as keyof typeof STAGE_SHORT]}"`
      if (role !== "staff") csv += `,"${event.billedAs ? "Billed" : "Not Billed"}","${event.billedAs?.billNumber || "-"}","${PAYMENT_SHORT[event.paymentStatus as keyof typeof PAYMENT_SHORT]}",${event.receivable},${event.advancePayment || 0},${remaining}`
      csv += "\n"
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const dateStr = startDate && endDate ? `_${startDate}_to_${endDate}` : ""
    a.download = `event-history${dateStr}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) return <Loading text="Loading events..." />

  return (
    <>

      <div className="space-y-6 animate-in">
        {/* ========== Header + Filters ========== */}
        <div className="no-print">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="flex items-center gap-2">
                <History className="w-8 h-8 text-primary" />
                Event History / इवेंट इतिहास
              </h1>
              <p className="text-muted-foreground mt-1">View and manage all your events</p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* CHANGED: derived stages replace active/completed/cancelled.
                    "Active" is the daily view — everything not closed out or called off. */}
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active (Upcoming + Done)</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="unbilled">Not Billed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
              </div>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate("") }}>
                  Clear
                </Button>
              )}
            </div>

            {/* Print Button */}
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileDown className="w-4 h-4 mr-1" />Export CSV
            </Button>

            {/* CHANGED: this is what reveals the checkboxes. Billing starts here — the
                operator is already looking at the event he wants to invoice — but the
                table stays clean until he says he is billing. */}
            {userRole !== "staff" && (
              selecting ? (
                <Button variant="ghost" size="sm" onClick={exitSelecting}>
                  <X className="w-4 h-4 mr-1" />Cancel
                </Button>
              ) : (
                <Button size="sm" onClick={() => setSelecting(true)}>
                  <Receipt className="w-4 h-4 mr-1" />Create Bill
                </Button>
              )
            )}
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block text-center mb-2">
          <h1 className="text-lg font-bold">Anchal Caterers — Event History</h1>
          {(startDate || endDate) && (
            <p className="text-xs text-muted-foreground">
              {startDate ? formatDate(startDate) : "..."} — {endDate ? formatDate(endDate) : "..."}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{filteredEvents.length} events</p>
        </div>

        {/* ========== Table ========== */}
        {filteredEvents.length === 0 ? (
          <EmptyState icon={History} title="No events found"
            description={search || statusFilter !== "all" || startDate || endDate ? "Try different filters" : "Create an event to get started"}
            action={<Link href="/create-event" className="btn-primary">Create Event</Link>}
          />
        ) : (
          <div className="border rounded-lg overflow-x-auto print:border-none">
            <table className="w-full text-sm print-table">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase border-b">
                  {/* CHANGED: billing selection, owner only — staff never bill anything.
                      Only present while the operator is actually picking events. */}
                  {userRole !== "staff" && selecting && <th className="p-3 w-8 no-print"></th>}
                  <th className="p-3 whitespace-nowrap">Organizer</th>
                  <th className="p-3 whitespace-nowrap">Home Address</th>
                  <th className="p-3 whitespace-nowrap">Event Date</th>
                  <th className="p-3 whitespace-nowrap">Venue Location</th>
                  <th className="p-3 whitespace-nowrap">Phone</th>
                  <th className="p-3 whitespace-nowrap">Meals / Sub-Events</th>
                  <th className="p-3 whitespace-nowrap text-center">Items</th>
                  <th className="p-3 whitespace-nowrap">Menu Created</th>
                  {/* CHANGED: "Status" is now "Stage" and is derived —
                      Upcoming / Done / Completed / Cancelled. */}
                  <th className="p-3 whitespace-nowrap">Stage</th>
                  {/* CHANGED: Billed is its OWN column. It used to be a stage, which meant
                      that the moment an event was invoiced its row stopped saying whether
                      the function had actually happened yet. Two independent facts, two
                      columns. Owner only — staff see nothing about billing. */}
                  {userRole !== "staff" && <th className="p-3 whitespace-nowrap">Billed</th>}
                  {/* CHANGED: Payment joins Advance behind the staff check. It is computed
                      from advancePayment, which staff are deliberately not sent, so for
                      them it could only ever have read "Unpaid" for every single row. */}
                  {userRole !== "staff" && (
                    <>
                      <th className="p-3 whitespace-nowrap">Payment</th>
                      <th className="p-3 whitespace-nowrap">Advance</th>
                    </>
                  )}
                  <th className="p-3 whitespace-nowrap no-print"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => {
                  const mealLabels = event.mealLabels || []
                  const totalItems = event.eventItems?.length || 0
                  const remaining = balanceOf(event.advancePayment || 0, event.receivable)
                  const isSelected = selectedIds.includes(event.id)
                  // Locked to one customer: once a row is ticked, other phone numbers
                  // are out of reach until the selection is cleared.
                  const selectable = selectionPhone === null || selectionPhone === event.phoneNumber

                  return (
                    <tr
                      key={event.id}
                      className={cn(
                        "border-b hover:bg-muted/30 transition-colors cursor-pointer",
                        selecting && isSelected && "bg-primary/5",
                        selecting && !selectable && "opacity-40"
                      )}
                      // While picking events for a bill, a row click ticks the row instead
                      // of navigating away — leaving the page would lose the selection.
                      onClick={() => {
                        if (selecting) { if (selectable) toggleSelected(event.id); return }
                        window.location.href = `/event-history/${event.id}`
                      }}
                    >
                      {/* CHANGED: billing selection checkbox (owner only, selection mode) */}
                      {userRole !== "staff" && selecting && (
                        <td className="p-3 no-print" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary disabled:opacity-30 disabled:cursor-not-allowed"
                            checked={isSelected}
                            disabled={!selectable}
                            title={selectable ? "Select for a bill" : "Different customer — clear the selection first"}
                            onChange={() => toggleSelected(event.id)}
                          />
                        </td>
                      )}

                      {/* Organizer */}
                      <td className="p-3">
                        <div>
                          <p className="font-semibold">{event.organizerName}</p>
                        </div>
                      </td>

                      {/* Home Address */}
                      <td className="p-3 text-muted-foreground max-w-[120px]">
                        <span className="truncate block text-xs" title={event.homeAddress || ""}>
                          {event.homeAddress || "—"}
                        </span>
                      </td>

                      {/* Event Date */}
                      <td className="p-3 whitespace-nowrap text-sm">
                        {formatDate(event.functionDate)}
                      </td>

                       {/* Venue Location */}
                      <td className="p-3 text-muted-foreground max-w-[120px]">
                        <span className="truncate block text-xs" title={event.location}>
                          {event.location}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="p-3 whitespace-nowrap text-muted-foreground text-xs">
                        {event.phoneNumber}
                      </td>


                      {/* Meals / Sub-Events */}
                      <td className="p-3">
                        {mealLabels.length > 0 ? (
                          <div className="space-y-0.5">
                            {/* CHANGED: shared compareMeals replaces an inline copy of the rank map */}
                            {[...mealLabels].sort(compareMeals).map((meal: any, idx: number) => (
                              <div key={idx} className="text-xs capitalize">
                                <span className="font-medium">{meal.label}</span>
                                {meal.date && (
                                  <span className="text-muted-foreground ml-1">
                                    {formatDate(meal.date).slice(0, 6)}
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-1">
                                  ({meal.guests || 0}g)
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">{event.guestCount} guests</span>
                        )}
                      </td>

                      {/* Total Items */}
                      <td className="p-3 text-center font-semibold text-xs">
                        {totalItems}
                      </td>

                      {/* Menu Creation Date */}
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {event.menuCreationDate ? formatDate(event.menuCreationDate) : "—"}
                      </td>

                      {/* CHANGED: Stage — derived, never stored. Timeline only. */}
                      <td className="p-3">
                        <Badge variant={STAGE_VARIANTS[event.stage as keyof typeof STAGE_VARIANTS] as any} className="text-xs">
                          {STAGE_SHORT[event.stage as keyof typeof STAGE_SHORT]}
                        </Badge>
                      </td>

                      {/* CHANGED: Billed — independent of the stage above. */}
                      {userRole !== "staff" && (
                        <td className="p-3">
                          {/* CHANGED: the bill number used to print under this badge and
                              made the column noisy. It is on the event's own page, and in
                              the selection bar when you are about to bill something. */}
                          {event.billedAs ? (
                            <Badge variant="primary" className="text-xs">Billed</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Billed</Badge>
                          )}
                        </td>
                      )}

                      {/* Payment + Advance (both hidden for staff) */}
                      {userRole !== "staff" && (
                        <>
                        <td className="p-3">
                          <Badge variant={PAYMENT_VARIANTS[event.paymentStatus as keyof typeof PAYMENT_VARIANTS] as any} className="text-xs">
                            {PAYMENT_SHORT[event.paymentStatus as keyof typeof PAYMENT_SHORT]}
                          </Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap text-xs">
                          {event.receivable > 0 ? (
                            <div>
                              <p className="font-semibold text-green-600 flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {(event.advancePayment || 0).toLocaleString("en-IN")}
                              </p>
                              {remaining > 0 && (
                                <p className="text-amber-600 flex items-center">
                                  <span className="text-muted-foreground mr-0.5">rem:</span>
                                  <IndianRupee className="w-3 h-3" />
                                  {remaining.toLocaleString("en-IN")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        </>
                      )}

                      {/* Arrow (screen only) */}
                      <td className="p-3 no-print">
                        <ArrowRight className="w-4 h-4 text-primary" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== Billing selection bar ========== */}
      {/* CHANGED: this is the new way a bill starts. The operator is already looking at
          the event he wants to invoice, so billing begins here rather than on a separate
          page where he would have to retype the customer's phone number to find it again.
          One bill can cover several events for one customer (the home functions and the
          wedding venue are separate events because the material goes to different
          places), which is why this is a multi-select and not a per-row button. */}
      {userRole !== "staff" && selecting && (
        <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-lg border bg-background shadow-lg">
          {selectedIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pick the events to bill — one customer at a time.
            </p>
          ) : (
            <div className="text-sm">
              <span className="font-semibold">{selectedIds.length} event{selectedIds.length > 1 ? "s" : ""}</span>
              <span className="text-muted-foreground"> · {selectionPhone}</span>
              <span className="ml-2 font-semibold text-primary inline-flex items-center">
                <IndianRupee className="w-3 h-3" />{selectedTotal.toLocaleString("en-IN")}
              </span>
              {selectedEvents.some(e => e.billedAs) && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Already billed: {selectedEvents.filter(e => e.billedAs).map(e => e.billedAs.billNumber).join(", ")}
                </p>
              )}
            </div>
          )}
          <Button size="sm" disabled={selectedIds.length === 0} onClick={createBillForSelection}>
            <Receipt className="w-4 h-4 mr-1" />Create Bill / बिल बनाएं
          </Button>
          <Button size="sm" variant="ghost" onClick={exitSelecting}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </>
  )
}